import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB = SERVER_DIR / "data" / "dalro.sqlite3"


def _load_env_file(path: Path) -> None:
    """server/.env.local의 KEY=VALUE를 읽는다. 이미 설정된 환경 변수가 우선한다."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        key, sep, value = line.strip().partition("=")
        if sep and key and not key.startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(SERVER_DIR / ".env.local")


def database_url() -> str:
    return os.environ.get("DALRO_DATABASE_URL", f"sqlite:///{DEFAULT_DB}")


def kakao_rest_api_key() -> str | None:
    # 서버 전용 비밀값. 앱 번들(EXPO_PUBLIC_*)에 넣지 않는다.
    return os.environ.get("KAKAO_REST_API_KEY") or None


def cors_origins() -> list[str]:
    # 데모 서버는 인증·쿠키가 없으므로 기본으로 모든 출처를 허용한다.
    raw = os.environ.get("DALRO_CORS_ORIGINS", "*")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


# 노션 '중간 발표 전 결과물 · PACE의 가중치 설정 및 cost 계산'(김시원)의 값.
PACE_STOP_WEIGHT = 0.83
PACE_SLOPE_WEIGHT = 0.17
PACE_ALPHA = 3.0  # 팀 실험값 a=0,1,3,5 중 '적정 우회'
STOP_DENSITY_CAP = 0.275  # Q3 + 1.5·IQR, 시설 수/m

FACILITY_BUFFER_M = 10.0  # 팀 공간 결합과 같은 10m 버퍼
SNAP_RADIUS_M = 50.0
BASE_PACE_S_PER_KM = 372  # 6′12″/km. 예상 시간 표시용 가정
# 러너가 통행할 수 없거나 PACE 코스에서 제외하는 도로 유형
NON_WALKABLE_FCLASS = {"busway", "motorway", "motorway_link", "trunk", "trunk_link"}
PACE_EXCLUDED_FCLASS = {"steps"}
