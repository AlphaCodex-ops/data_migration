from pathlib import Path

import pyarrow.parquet as pq
from fastapi.testclient import TestClient

from app import main


def test_upload_publishes_source_and_parquet(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    client = TestClient(main.app)

    response = client.post(
        "/api/ingestions",
        files={"file": ("orders.csv", b"id,total\n1,12.5\n2,9.0\n", "text/csv")},
    )

    assert response.status_code == 201
    result = response.json()
    ingestion = tmp_path / "ingestions" / result["ingestion_id"]
    assert (ingestion / "bronze" / "orders.csv").read_bytes() == b"id,total\n1,12.5\n2,9.0\n"
    table = pq.read_table(ingestion / "silver" / "data.parquet")
    assert table.num_rows == 2
    assert table.column_names == ["id", "total"]
    assert result["row_count"] == 2


def test_malformed_row_is_rejected_without_publishing(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    client = TestClient(main.app)

    response = client.post(
        "/api/ingestions",
        files={"file": ("broken.csv", b"id,total\n1,12.5\n2\n", "text/csv")},
    )

    assert response.status_code == 422
    assert "Row 3" in response.json()["detail"]
    assert not (tmp_path / "ingestions").exists()