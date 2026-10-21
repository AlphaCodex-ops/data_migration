# CSV Lakehouse: End-to-End Project Guide

## 1. What this project does

CSV Lakehouse is a local-first application for taking one CSV file through a small, repeatable ingestion pipeline:

1. A user selects or drops a CSV in the browser.
2. The API validates the file and its row structure.
3. The original upload is preserved in a **bronze** folder.
4. PyArrow infers a table from the CSV and writes it as Parquet in a **silver** folder.
5. The browser displays the ingestion ID, row count, columns, and local output path.

The current project is an ingestion foundation and a practical demonstration of a lakehouse-style raw/curated layout. It is **not yet a complete migration platform**: it does not connect to a source database or existing warehouse, coordinate bulk or incremental migrations, define business transformations, or publish data to a cloud lake, catalog, or warehouse.

## 2. Technology stack and why it is used

| Technology | Where it is used | Role in this project |
| --- | --- | --- |
| Python 3.11+ | Backend | Runtime for the HTTP API, input validation, and ingestion workflow. |
| FastAPI | `backend/app/main.py` | Defines the health and upload endpoints, validates HTTP input, handles multipart uploads, and returns JSON errors and results. Its generated interactive API documentation is available at `/docs` while the API is running. |
| Uvicorn | Backend runtime | ASGI server that runs the FastAPI application locally. |
| PyArrow | Backend conversion | Reads validated CSV data into a columnar Arrow table, infers column types, and writes a columnar Parquet file. |
| Python `csv` and `io` | Backend validation | Checks UTF-8 CSV syntax, headers, and the number of fields in each record before publication. |
| Python `pathlib`, `tempfile`, `uuid`, and `os` | Backend storage | Builds filesystem paths, stages artifacts, gives each ingestion a unique ID, and publishes a completed directory with a same-filesystem rename. |
| React | `frontend/src` | Implements the interactive upload screen and renders upload progress, errors, and results. |
| TypeScript | `frontend/src` | Types frontend state and the ingestion response; strict TypeScript checks run as part of the frontend build. |
| Vite | `frontend/vite.config.ts` | Serves the frontend in development, applies the React plugin, and proxies `/api` calls to the backend at `http://localhost:8000`. |
| Lucide React | `frontend/src/App.tsx` | Supplies the upload, file, status, and navigation icons. |
| Local filesystem | `data/` by default/configuration | Stores the immutable uploaded source and its Parquet representation. `LAKEHOUSE_DATA_DIR` selects the root directory. |
| pytest and FastAPI TestClient | `backend/tests` | Exercise the upload endpoint and verify that artifacts are produced or rejected as expected. |
| npm | `frontend/package.json` | Installs frontend dependencies and runs the development, type-check, and build scripts. |

The dependency declarations live in [backend/pyproject.toml](../backend/pyproject.toml) and [frontend/package.json](../frontend/package.json). The stack choice is recorded in [decision 0001](decisions/0001-stack-and-storage.md).

## 3. System architecture

```text
User
  |
  v
React + TypeScript browser app (Vite on localhost:5173)
  |  POST /api/ingestions (multipart/form-data)
  |  Vite proxies /api to localhost:8000
  v
FastAPI + Uvicorn (localhost:8000)
  |-- validate upload and CSV records
  |-- PyArrow: CSV -> Arrow table -> Parquet
  |-- stage source + output, then publish completed ingestion
  v
Local filesystem (LAKEHOUSE_DATA_DIR)
  ingestions/<uuid>/bronze/<source>.csv
  ingestions/<uuid>/silver/data.parquet
```

The browser is responsible for file selection, basic early checks, sending the request, and presenting its result. The backend is authoritative: it rechecks the extension and size, parses and validates the full content, converts it, and writes the artifacts. This prevents a browser-only check from being mistaken for data validation.

The API allows browser requests from `http://localhost:5173` through its configured CORS middleware. In the normal development setup, the Vite proxy sends `/api` requests to the API, so the frontend uses a relative `/api/ingestions` URL.

## 4. End-to-end ingestion lifecycle

### 4.1 Select and submit

The screen in [App.tsx](../frontend/src/App.tsx) accepts a `.csv` file through a file picker or drag-and-drop. It rejects a non-CSV filename and a file larger than 50 MiB in the interface, then sends the selected file as `multipart/form-data` to `POST /api/ingestions`.

The browser checks improve usability, but they are not a security boundary; the API performs its own checks.

### 4.2 Validate on the API

The API in [main.py](../backend/app/main.py) performs these checks before publishing anything:

- The filename has a `.csv` extension. The basename is used as the stored filename.
- The request body is at most 50 MiB; the server reads at most one byte beyond the limit to detect an oversized file.
- The upload is not empty.
- The bytes decode as UTF-8. A UTF-8 byte-order mark is accepted.
- The CSV has a header row, and its header fields are non-empty and unique.
- The CSV syntax is valid, and each data row has exactly the header's number of fields.

The server then asks PyArrow to read the CSV and infer a table schema. A CSV that passes the structural checks can still be rejected if PyArrow cannot convert its values. A header-only CSV is accepted and creates a zero-row table.

### 4.3 Preserve the source and create the curated file

Each accepted request receives a new UUID. The API creates a temporary staging directory beneath the configured data root, writes the original uploaded bytes to `bronze/<original-filename>.csv`, and writes the inferred table to `silver/data.parquet`.

After both files have been created successfully, the staging directory is renamed into `ingestions/<uuid>`. The intent is that consumers see a completed ingestion directory, rather than a published directory containing only one of the two artifacts. Validation errors do not publish an ingestion directory.

### 4.4 Return a result

On success, the API responds with HTTP `201` and a JSON object containing:

- `ingestion_id`: generated UUID.
- `filename`: sanitized source basename.
- `row_count`: number of data records, not including the header.
- `columns`: column names from the Arrow table.
- `parquet_path`: local filesystem path to the silver Parquet file.

Processing is synchronous. A successful response means the files were written and published; there is no job queue or polling step. The frontend shows the response fields and local path. The API does not currently provide a download endpoint.

## 5. Lakehouse concepts in this project

The project's folders use the common medallion-style names:

```text
<LAKEHOUSE_DATA_DIR>/
  ingestions/
    <uuid>/
      bronze/
        <original-filename>.csv
      silver/
        data.parquet
```

- **Bronze (raw):** preserves the uploaded CSV bytes. Keeping the source makes the ingestion auditable and allows future reprocessing if the conversion rules change. The application does not modify or enrich the raw records.
- **Silver (curated/usable):** contains a typed, columnar Parquet representation. Parquet is designed for analytical workloads and is supported by many data tools. In this version, “curated” means validated and converted; it does not mean business-cleaned, deduplicated, reconciled, or certified.
- **Gold (serving/business layer):** not implemented. A future gold layer could contain domain-approved metrics, aggregates, or models for specific consumers.

An ingestion UUID keeps each upload separate and avoids silently overwriting earlier ingestions. It is an ingestion identifier, not a schema version, business key, or idempotency key.

## 6. How this helps a data-lake/warehouse migration

This project is useful as a **small ingestion and landing-zone pattern** in a larger migration:

1. **Separates source preservation from transformed data.** Keeping a raw copy alongside a converted representation gives migration teams a baseline for replay, comparison, and investigation.
2. **Makes data structurally checkable at intake.** Invalid encodings, duplicate/blank headers, malformed CSV, and inconsistent row widths are rejected early rather than becoming opaque downstream failures.
3. **Moves data into an analytical format.** Parquet is more appropriate than CSV for many lake query engines because it stores typed, columnar data and can support efficient column-oriented reads.
4. **Creates a per-ingestion boundary.** A UUID path makes it straightforward to keep separate upload runs and inspect their outputs.
5. **Demonstrates a bronze-to-silver pipeline.** The application provides a simple reference point for adding schema management, transformations, orchestration, catalogs, and cloud storage later.
6. **Keeps the first migration experiment easy to operate.** A local user can validate the basic CSV-to-Parquet path without cloud accounts or a separate catalog service.

For a real warehouse or lake migration, this application would be one component at the edge of a broader system. Source extraction, data reconciliation, incremental capture, permissions, transformation rules, orchestration, and target cutover remain outside the current implementation.

### Current capability versus a fuller migration platform

| Migration concern | Current state | What a production migration typically adds |
| --- | --- | --- |
| Source | User-uploaded CSV only | Database/warehouse connectors, exports, snapshots, or change-data capture (CDC). |
| Scale | One synchronous upload up to 50 MiB | Chunking/streaming, parallel workers, quotas, backpressure, retry and resume support. |
| Schema | PyArrow inference per file | Versioned schemas, explicit mappings, compatibility checks, drift alerts, and governed type conversions. |
| Transformation | CSV parsing and Parquet conversion | Documented business rules, cleansing, deduplication, key handling, and lineage. |
| Destination | Local filesystem | Object storage or a lakehouse table format, plus a catalog/metastore and query engine. |
| Reliability | Temporary staging and final directory rename | Durable job state, idempotency, checkpoints, retries, dead-letter handling, and recovery procedures. |
| Validation | Encoding, CSV structure, inferred conversion | Source-to-target row counts, checksums, aggregates, referential checks, and business reconciliation. |
| Security and operations | Trusted single local user | Authentication, authorization, tenant isolation, encryption, secrets, audit, monitoring, and retention controls. |
| Consumption | No query or download API | Governed table registration, query access, data products, and documented SLAs. |

## 7. Data contract and limitations

- Input is one UTF-8 CSV per request, up to 50 MiB. UTF-8 BOM is accepted.
- The first record is the header; header names must be non-empty and unique.
- All records must have the same number of fields as the header.
- PyArrow infers the output column types independently from each file. Values and schemas can therefore behave differently across uploads. Consumers needing stable types should not assume inference is a governed schema.
- The original CSV is retained, with no automatic retention/deletion policy.
- Upload retries create new UUID ingestions; the endpoint is not idempotent.
- The local path in the response is diagnostic, not a stable cross-machine identifier or a downloadable URL.
- There is no authentication, authorization, user isolation, catalog, partitioning, schema registry, gold layer, or hosted deployment support.
- The repository's sample dataset includes credential-like fields. Treat uploaded data as potentially sensitive: do not upload real credentials or personal data to an environment without appropriate approval and controls.

Read the detailed [data contract](data-contract.md), [API contract](api.md), [architecture](architecture.md), and [deployment guidance](deployment.md) before changing operational assumptions.

## 8. Run the project locally

Requirements: Python 3.11 or newer, and Node.js 20 or newer with npm.

In PowerShell, start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
$env:LAKEHOUSE_DATA_DIR = "..\data"
uvicorn app.main:app --reload
```

In a second PowerShell terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` to use the UI. The API is at `http://localhost:8000`, its interactive reference is at `http://localhost:8000/docs`, and its health check is `http://localhost:8000/api/health`.

`LAKEHOUSE_DATA_DIR` defaults to `./data`, resolved relative to the backend process's current working directory. Set it explicitly to avoid ambiguity. Keep private datasets out of source control and choose a location with adequate free disk space.

## 9. Test and build

Run backend tests from `backend/`:

```powershell
python -m pytest
```

Run the frontend type check and production build from `frontend/`:

```powershell
npm run check
npm run build
```

The backend tests use temporary storage and check successful artifact creation, Parquet readability, and rejection of a malformed row without publishing an ingestion. See [development guidance](development.md) for extending coverage.

## 10. Suggested path from prototype to migration service

1. **Define a migration contract:** identify source and target systems, supported formats, stable schema/type mappings, ownership, and data-quality requirements.
2. **Add explicit schema and validation:** make types and nullability intentional; version schemas and report drift instead of relying on inference alone.
3. **Add reconciliation:** compare source and output counts, key coverage, null counts, and agreed aggregates; retain a migration report per run.
4. **Move storage and processing to durable services:** use managed object storage and a table/catalog/query layer; use background jobs for larger datasets.
5. **Make runs recoverable:** add job state, idempotency, checkpoints, retries, cancellation, and observability.
6. **Introduce source connectors and incremental migration:** implement snapshots and, where needed, CDC with defined ordering and delete semantics.
7. **Secure and govern the service:** add identity, access controls, encryption, audit, retention, secret handling, and operational runbooks before shared or hosted use.
8. **Plan cutover:** run source/target comparisons, shadow reads, stakeholder sign-off, rollback planning, and only then switch consumers to the destination.

These are recommendations for future work, not claims about features already present.
