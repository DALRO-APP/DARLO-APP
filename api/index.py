"""같은 Vercel 배포의 /api/* → DALRO FastAPI."""

import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from dalro_api.demo_seed import SEED_PATH
from dalro_api.main import create_app


class ApiPathMiddleware:
    """Vercel rewrite가 전달한 경로를 복원하고 실제 검색 query는 보존한다."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            query = parse_qsl(scope.get("query_string", b"").decode(), keep_blank_values=True)
            forwarded = next((value for key, value in query if key == "__dalro_path"), None)
            path = "/" + forwarded.lstrip("/") if forwarded is not None else scope["path"].removeprefix("/api") or "/"
            scope = {**scope, "path": path, "raw_path": path.encode(), "query_string": urlencode([(k, v) for k, v in query if k != "__dalro_path"]).encode()}
        await self.app(scope, receive, send)


app = create_app(seed_path=SEED_PATH)
app.add_middleware(ApiPathMiddleware)
