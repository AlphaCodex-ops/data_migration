# Architecture

## Scope

The MVP is a single-user application running on the user's machine. A React browser client sends one CSV at a time to a FastAPI service. The service validates the complete upload, keeps the original bytes, infers a columnar table with PyArrow, and publishes raw and curated artifacts under one unique ingestion ID.

## Components

- `frontend/`: Vite-hosted React/TypeScript interface. It submits `multipart/form-data` and displays the resulting ingestion ID, row count, and columns.
- `backend/app/main.py`: FastAPI routes, CSV validation, and local publication.
- PyArrow: type inference and Parquet serialization.
- Local filesystem: source and curated artifact storage rooted at `LAKEHOUSE_DATA_DIR`.

## Ingestion flow

1. Browser submits a `.csv` file to `POST /api/ingestions`.
2. API checks extension, size, UTF-8 decoding, header uniqueness/non-emptiness, CSV syntax, and consistent row widths.
3. PyArrow reads the validated CSV and infers column types.
4. API writes source and Parquet to a temporary directory on the destination filesystem.
5. API atomically renames the staged directory to `ingestions/<uuid>` and returns metadata.

Validation failures return a client error and do not publish an ingestion directory. There is no background queue or persistent job state in this first synchronous implementation; successful upload response means both artifacts were published.

## Storage layout

```text
<LAKEHOUSE_DATA_DIR>/
  ingestions/
    <uuid>/
      bronze/<original-filename>.csv
      silver/data.parquet
```

The source is retained as received. Silver contains one Parquet file with inferred types. Partitioning, schema registry, catalog, and business-specific gold transformations are intentionally deferred.

## Trust boundary

The current app assumes a trusted local user. It has no authentication, authorization, per-user isolation, or CSRF protection. Do not expose it to a network or deploy it as a shared service without the controls in [Deployment](deployment.md).