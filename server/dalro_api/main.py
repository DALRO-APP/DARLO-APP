"""DALRO 추천 API.

    uvicorn dalro_api.main:app --reload            # server/ 에서
    uvicorn dalro_api.main:app --host 0.0.0.0      # 같은 Wi-Fi의 휴대폰(Expo Go)에서 접속
"""

from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import cors_origins
from .db import init_db, make_engine, session_factory
from .graph import RoadGraph
from .schemas import Course, RecommendationRequest, RecommendationResponse
from .service import RecommendationService, StartNotCovered, UnsupportedPurpose


def create_app(database_url: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = make_engine(database_url)
        init_db(engine)
        sessions = session_factory(engine)
        try:
            with sessions() as session:
                graph = RoadGraph.load(session)
            app.state.service = RecommendationService(graph, sessions)
            app.state.load_error = None
        except LookupError as error:
            app.state.service = None
            app.state.load_error = str(error)
        yield
        engine.dispose()

    app = FastAPI(title="DALRO API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    def service() -> RecommendationService:
        if app.state.service is None:
            raise HTTPException(503, app.state.load_error)
        return app.state.service

    @app.get("/health")
    def health():
        current = app.state.service
        if current is None:
            return {"status": "no-network", "detail": app.state.load_error}
        graph = current.graph
        return {
            "status": "ok",
            "data_version": graph.version,
            "edges": len(graph.edges),
            "nodes": len(graph.nodes_xy),
            "purposes": ["PACE"],
            "network_stats": graph.stats,
        }

    @app.post(
        "/v1/courses/recommendations",
        response_model=RecommendationResponse,
        response_model_exclude_unset=True,
    )
    def recommend(request: RecommendationRequest = Body(...)):
        try:
            return service().recommend(request)
        except UnsupportedPurpose as error:
            raise HTTPException(501, str(error)) from error
        except StartNotCovered as error:
            raise HTTPException(422, str(error)) from error

    @app.get("/v1/courses/{course_id}", response_model=Course, response_model_exclude_unset=True)
    def get_course(course_id: str):
        course = service().get_course(course_id)
        if course is None:
            raise HTTPException(404, "코스를 찾을 수 없습니다. 홈에서 다시 추천받아 주세요.")
        return course

    return app


app = create_app()
