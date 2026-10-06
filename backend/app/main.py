import csv
import io
import os
import tempfile
from pathlib import Path
from uuid import uuid4

import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.parquet as pq
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(os.environ.get("LAKEHOUSE_DATA_DIR", "./data")).resolve()
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

app = FastAPI(title="CSV Lakehouse API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def parse_csv(content: bytes) -> tuple[pa.Table, int]:
    try:
        text = content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text, newline=""), strict=True)
        headers = next(reader)
    except (UnicodeDecodeError, csv.Error, StopIteration) as error:
        raise ValueError("File must be a non-empty UTF-8 CSV with a header row") from error

    if not headers or any(not header.strip() for header in headers):
        raise ValueError("CSV headers must be non-empty")
    if len(set(headers)) != len(headers):
        raise ValueError("CSV headers must be unique")

    rows = []
    try:
        for row_number, values in enumerate(reader, start=2):
            if len(values) != len(headers):
                raise ValueError(
                    f"Row {row_number} has {len(values)} fields; expected {len(headers)}"
                )
            rows.append(values)
    except csv.Error as error:
        raise ValueError(f"Malformed CSV near row {reader.line_num}") from error

    normalized = text.encode("utf-8")
    try:
        table = pacsv.read_csv(pa.BufferReader(normalized))
    except (pa.ArrowException, ValueError) as error:
        raise ValueError(f"CSV values could not be converted: {error}") from error
    return table, len(rows)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ingestions", status_code=201)
async def create_ingestion(file: UploadFile = File(...)) -> dict[str, object]:
    filename = Path(file.filename or "").name
    if not filename or Path(filename).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Upload a file with a .csv extension")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 50 MiB upload limit")
    if not content:
        raise HTTPException(status_code=422, detail="CSV file is empty")

    try:
        table, row_count = parse_csv(content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    ingestion_id = str(uuid4())
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix=f".{ingestion_id}-", dir=DATA_DIR) as temporary:
            staged = Path(temporary)
            bronze = staged / "bronze"
            silver = staged / "silver"
            bronze.mkdir()
            silver.mkdir()
            (bronze / filename).write_bytes(content)
            pq.write_table(table, silver / "data.parquet")
            destination = DATA_DIR / "ingestions" / ingestion_id
            destination.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staged, destination)
    except (OSError, pa.ArrowException) as error:
        raise HTTPException(status_code=500, detail="Could not publish the ingestion") from error

    return {
        "ingestion_id": ingestion_id,
        "filename": filename,
        "row_count": row_count,
        "columns": table.column_names,
        "parquet_path": str(destination / "silver" / "data.parquet"),
    }