# Development

## Prerequisites

Install Python 3.11+ and Node.js 20+. Run the API from `backend/` and the Vite client from `frontend/` in separate terminals. The README contains PowerShell setup commands.

## Configuration

`LAKEHOUSE_DATA_DIR` sets the root for local ingestions. It defaults to `./data`, resolved relative to the API process working directory. For development, set it explicitly to `../data` while the current directory is `backend/`. Never use a source-controlled directory for private datasets.

## Tests

Backend tests use pytest and FastAPI's test client. They set a temporary data root to avoid writing user data. Run `python -m pytest` from `backend/`.

When adding ingestion features, cover validation failures, artifact preservation, Parquet readability, and publication behavior. Use temporary directories in tests and never rely on a real local dataset.

## Boundaries

Keep HTTP concerns and filesystem publication close to the API until a second storage implementation or asynchronous workflow justifies a separate abstraction. Keep raw source immutable. Any schema evolution or overwrite behavior should be explicit in the API and data contract before implementation.