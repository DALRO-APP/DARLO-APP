"""고정 공간자료만 Vercel에 포함하고, 인스턴스별 임시 SQLite로 복원한다.

    cd server && .venv/bin/python -m dalro_api.demo_seed

원본 DB는 SQLite backup API로 읽는다. 원본이나 실행 중인 WAL은 수정하지 않는다.
"""

import argparse
import gzip
import hashlib
import sqlite3
import tempfile
from pathlib import Path

from .config import DEFAULT_DB

SEED_PATH = Path(__file__).resolve().parent.parent / "seed" / "yongsan-network.sql.gz"
NETWORK_TABLES = ("network_versions", "road_nodes", "road_edges", "facilities", "service_areas", "places")
TEMPORARY_TABLES = ("courses", "recommendation_logs")


def export_seed(source: Path, target: Path) -> dict[str, int]:
    """코스·로그·사용자 입력을 비운 네트워크 스냅샷. 날짜 없는 gzip으로 재현 가능하게 만든다."""
    with sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True) as original:
        with sqlite3.connect(":memory:") as snapshot:
            original.backup(snapshot)
            if snapshot.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("원본 DB 무결성 검사에 실패했습니다.")
            tables = {row[0] for row in snapshot.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            unexpected = tables - set(NETWORK_TABLES) - set(TEMPORARY_TABLES) - {"sqlite_sequence"}
            if unexpected:
                raise ValueError(f"배포 자료에 허용되지 않은 테이블: {sorted(unexpected)}")
            for table in TEMPORARY_TABLES:
                snapshot.execute(f'DELETE FROM "{table}"')
            counts = {table: snapshot.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in NETWORK_TABLES}
            if not counts["road_edges"] or not counts["network_versions"]:
                raise ValueError("배포할 도로망이 없습니다.")
            sql = "\n".join(snapshot.iterdump()).encode()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(gzip.compress(sql, mtime=0))
    return counts


def restore_seed(seed: Path, directory: Path | None = None) -> Path:
    """불변 배포 자료를 새 임시 디렉터리에 복원한다. 다른 인스턴스와 쓰기 DB를 공유하지 않는다."""
    if not seed.is_file():
        raise FileNotFoundError("배포 공간자료가 없습니다. python -m dalro_api.demo_seed를 먼저 실행하세요.")
    target = Path(tempfile.mkdtemp(prefix="dalro-demo-", dir=directory)) / "dalro.sqlite3"
    try:
        with sqlite3.connect(target) as database:
            database.executescript(gzip.decompress(seed.read_bytes()).decode())
            if database.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("복원한 배포 자료의 무결성 검사에 실패했습니다.")
            if database.execute("PRAGMA foreign_key_check").fetchone():
                raise ValueError("복원한 배포 자료의 참조 검사에 실패했습니다.")
        return target
    except Exception:
        # 이 함수가 만든 새 DB만 정리한다. 실행 중인 DB에는 접근하지 않는다.
        target.unlink(missing_ok=True)
        target.parent.rmdir()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_DB)
    parser.add_argument("--output", type=Path, default=SEED_PATH)
    args = parser.parse_args()
    counts = export_seed(args.source, args.output)
    print(f"고정 공간자료: {counts}")
    print(f"{args.output.name}: {args.output.stat().st_size:,} bytes · sha256 {hashlib.sha256(args.output.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
