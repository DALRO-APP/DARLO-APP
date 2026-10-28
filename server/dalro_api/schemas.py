"""앱 계약(src/domain/contracts.ts, docs/contracts/*.schema.json)의 Pydantic 표현."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from .geo import haversine

Lon = Annotated[float, Field(ge=-180, le=180)]
Lat = Annotated[float, Field(ge=-90, le=90)]
Position = tuple[Lon, Lat]
Purpose = Literal["PACE", "POWER", "NIGHT", "GREEN"]
Label = Annotated[str, Field(min_length=1, max_length=40)]


class _RequestBase(BaseModel):
    schema_version: Literal["1.0"]
    start: Position
    purpose: Purpose
    time_of_day: Literal["day", "night"]
    distance_tolerance_ratio: float = Field(ge=0, le=0.3)
    # 검색으로 고른 장소 이름. 코스의 start_label/end_label로 그대로 쓴다.
    start_label: Label | None = None


class LoopRequest(_RequestBase):
    route_type: Literal["loop"]
    target_distance_m: int = Field(ge=1000, le=20000)


class StraightRequest(_RequestBase):
    route_type: Literal["straight"]
    end: Position
    end_label: Label | None = None
    target_distance_m: None

    @model_validator(mode="after")
    def _apart(self):
        if haversine(self.start, self.end) < 50:
            raise ValueError("출발지와 목적지는 50m 이상 떨어져 있어야 합니다.")
        return self


RecommendationRequest = Annotated[LoopRequest | StraightRequest, Field(discriminator="route_type")]


class Reason(BaseModel):
    code: Literal["flat", "hill", "lighting", "green", "signals", "loop", "destination"]
    title: str
    description: str


class Segment(BaseModel):
    id: str
    name: str
    description: str
    distance_from_start_m: float = Field(ge=0)


class Geometry(BaseModel):
    type: Literal["LineString"]
    coordinates: list[Position] = Field(min_length=4)


class Summary(BaseModel):
    distance_m: float = Field(gt=0)
    estimated_duration_s: float = Field(gt=0)
    elevation_gain_m: float | None = Field(ge=0)
    avg_slope_pct: float | None = Field(ge=0)
    signal_count: int | None = Field(ge=0)
    crossing_count: int | None = Field(ge=0)
    light_count: int | None = Field(ge=0)
    green_ratio: float | None = Field(ge=0, le=1)
    environment_score: float | None = Field(ge=0, le=100)


class Course(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    subtitle: str
    purpose: Purpose
    region: str
    start_label: str
    route_type: Literal["loop", "straight"]
    end: Position | None = None
    end_label: str | None = None
    geometry: Geometry
    summary: Summary
    reasons: list[Reason]
    segments: list[Segment] = Field(min_length=2)
    edge_ids: list[str]
    data_version: str
    algorithm_version: str
    is_mock: bool


class PlaceResult(BaseModel):
    id: str
    name: str
    address: str
    category: str
    position: Position
    # 실제 출발·도착에 쓰는 도로 위 지점. 범위 밖이거나 300m 안에 도로가 없으면 null
    start_position: Position | None
    in_service_area: bool
    source: Literal["kakao", "local"]


class PlaceSearchResponse(BaseModel):
    query: str
    service_area: str
    places: list[PlaceResult]
    notice: str | None


class RecommendationResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    request_id: str
    courses: list[Course] = Field(max_length=3)
