# Data Contract

## Input

- One `.csv` file per request, maximum size 50 MiB.
- UTF-8 text is required; a UTF-8 byte-order mark is accepted.
- First record is the header. Header names must be non-empty and unique.
- Every data record must contain exactly as many fields as the header.
- Empty files, malformed CSV syntax, invalid encoding, and inconsistent row widths are rejected.
- A header-only file is valid and produces a zero-row Parquet table.

## Type inference

PyArrow infers column types from the CSV values. No user-defined schema or coercion interface exists in the MVP. Inference can vary with input values; consumers needing stable types should validate downstream until explicit schema support is implemented.

## Output and retention

Each successful upload creates `ingestions/<uuid>/bronze/<original-filename>.csv` and `ingestions/<uuid>/silver/data.parquet` below `LAKEHOUSE_DATA_DIR`. The bronze file retains its uploaded bytes, and the Parquet file is the inferred silver representation. Existing ingestions are not overwritten. No automatic deletion or retention schedule is currently implemented; operators manage the local data directory.

Publication stages both artifacts in a temporary sibling directory and renames the completed directory into place. Failed validation does not create a published ingestion. Disk or serialization failures return an error; operators should check available disk space before retrying.

## Response metadata

The successful response includes a UUID ingestion ID, sanitized filename, row count, column names, and local Parquet path. The local path is diagnostic metadata for the single-user interface, not a downloadable URL or portable storage identifier.