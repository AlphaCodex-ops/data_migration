# API Contract

Base URL for local development: `http://localhost:8000`.

## Health

`GET /api/health`

```json
{"status":"ok"}
```

## Create ingestion

`POST /api/ingestions` as `multipart/form-data`, with a required `file` field containing one `.csv` file.

Success response: HTTP `201 Created`.

```json
{
  "ingestion_id": "6aac8d8a-4a62-4dc6-bd4d-106ddc3bbd25",
  "filename": "orders.csv",
  "row_count": 2,
  "columns": ["id", "total"],
  "parquet_path": "<data-root>/ingestions/<id>/silver/data.parquet"
}
```

Errors use FastAPI's `{"detail":"..."}` envelope: `400` for a missing/non-CSV filename, `413` above 50 MiB, and `422` for empty content, encoding, CSV syntax, header, or row-shape validation failures. Storage/serialization errors return `500`. Error messages should be treated as diagnostic text, not a stable machine-readable code.

## Semantics

Processing is synchronous. There is no job polling endpoint in the MVP: the `201` response means publication completed. Every accepted request creates a new UUID path; retries are independent uploads, not idempotent requests. The API does not expose artifact download endpoints.