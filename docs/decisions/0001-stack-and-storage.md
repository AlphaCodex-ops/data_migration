# Decision 0001: Local-First Web Stack

- Status: Accepted
- Date: 2026-10-05

## Context

The project starts with no code or framework and needs a browser upload workflow for CSV files that become a simple local lakehouse.

## Decision

Use React with Vite for the browser interface and FastAPI with PyArrow for the API and CSV-to-Parquet conversion. Keep raw CSV and curated Parquet in local filesystem folders, partitioned by a generated ingestion UUID. Design and document this as a single-user local application.

## Consequences

This keeps the first version easy to run and inspect without a cloud account or catalog. Local storage is not a multi-user security boundary. Hosted operation requires explicit identity, isolation, limits, and a storage backend redesign. PyArrow inference does not guarantee stable schema across uploads.