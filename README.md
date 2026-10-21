# CSV Lakehouse

A local-first web application for uploading CSV files, preserving each source file, validating its rows, and writing a curated Parquet copy. The first version uses FastAPI, PyArrow, React, and Vite. It is intended for one local user; it is not a secured multi-user service.

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer with npm

## Run locally

In one terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
$env:LAKEHOUSE_DATA_DIR = "../data"
uvicorn app.main:app --reload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The API listens on http://localhost:8000. Its interactive API reference is at http://localhost:8000/docs.

## Test

```powershell
cd backend
python -m pytest
```

## Data behavior

Uploads are limited to 50 MiB, must be UTF-8 CSV, and must have unique, non-empty headers with consistent row widths. Files are kept in `data/ingestions/<id>/bronze/`; the inferred Parquet table is written to `data/ingestions/<id>/silver/data.parquet`. Each successful upload receives a unique ID. See [the data contract](docs/data-contract.md), [API contract](docs/api.md), and [development guide](docs/development.md).

## Project documentation

- [End-to-end project guide](docs/project-guide.md)
- [Architecture](docs/architecture.md)
- [Data contract](docs/data-contract.md)
- [API](docs/api.md)
- [Development](docs/development.md)
- [Deployment](docs/deployment.md)
- [Architecture decisions](docs/decisions/)