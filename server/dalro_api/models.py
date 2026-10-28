from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class NetworkVersion(Base):
    """임포트한 도로망 한 벌. 코스의 data_version과 같다."""

    __tablename__ = "network_versions"

    version: Mapped[str] = mapped_column(String, primary_key=True)
    region: Mapped[str] = mapped_column(String)
    source_crs: Mapped[str] = mapped_column(String)
    sources: Mapped[list] = mapped_column(JSON)
    edge_count: Mapped[int] = mapped_column(Integer)
    node_count: Mapped[int] = mapped_column(Integer)
    quality: Mapped[dict] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RoadNode(Base):
    __tablename__ = "road_nodes"

    version: Mapped[str] = mapped_column(
        ForeignKey("network_versions.version", ondelete="CASCADE"), primary_key=True
    )
    node_id: Mapped[str] = mapped_column(String, primary_key=True)
    lon: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)
    x: Mapped[float] = mapped_column(Float)  # EPSG:5186 m
    y: Mapped[float] = mapped_column(Float)


class RoadEdge(Base):
    """팀 도로 피처를 교차 지점에서 나눈 탐색용 구간."""

    __tablename__ = "road_edges"

    version: Mapped[str] = mapped_column(
        ForeignKey("network_versions.version", ondelete="CASCADE"), primary_key=True
    )
    edge_id: Mapped[str] = mapped_column(String, primary_key=True)
    source_fid: Mapped[int] = mapped_column(Integer, index=True)
    osm_id: Mapped[str | None] = mapped_column(String, nullable=True)
    from_node: Mapped[str] = mapped_column(String)
    to_node: Mapped[str] = mapped_column(String)
    length_m: Mapped[float] = mapped_column(Float)
    fclass: Mapped[str] = mapped_column(String)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    layer: Mapped[int] = mapped_column(Integer, default=0)
    bridge: Mapped[bool] = mapped_column(Boolean, default=False)
    tunnel: Mapped[bool] = mapped_column(Boolean, default=False)
    walkable: Mapped[bool] = mapped_column(Boolean)
    access_note: Mapped[str | None] = mapped_column(String, nullable=True)
    # 원본 피처(10m 버퍼) 기준 팀 속성
    feature_signal_cnt: Mapped[int] = mapped_column(Integer)
    feature_cross_cnt: Mapped[int] = mapped_column(Integer)
    feature_length_m: Mapped[float] = mapped_column(Float)
    slope_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    slope_norm: Mapped[float | None] = mapped_column(Float, nullable=True)
    stop_den: Mapped[float] = mapped_column(Float)
    stop_norm: Mapped[float] = mapped_column(Float)
    # 이 구간 10m 버퍼로 다시 센 시설 수
    signal_cnt: Mapped[int] = mapped_column(Integer)
    cross_cnt: Mapped[int] = mapped_column(Integer)
    light_cnt: Mapped[int] = mapped_column(Integer)
    coords_lonlat: Mapped[list] = mapped_column(JSON)
    coords_xy: Mapped[list] = mapped_column(JSON)


class Facility(Base):
    """코스별 시설 수를 중복 없이 세기 위한 원본 위치."""

    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(
        ForeignKey("network_versions.version", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String, index=True)  # signal | crosswalk | streetlight
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    wkb: Mapped[bytes] = mapped_column(LargeBinary)  # EPSG:5186


class ServiceArea(Base):
    """베타 서비스 범위(용산구 행정경계)."""

    __tablename__ = "service_areas"

    version: Mapped[str] = mapped_column(
        ForeignKey("network_versions.version", ondelete="CASCADE"), primary_key=True
    )
    name: Mapped[str] = mapped_column(String)
    wkb: Mapped[bytes] = mapped_column(LargeBinary)  # EPSG:5186


class Place(Base):
    """카카오 키가 없어도 쓰는 로컬 장소 검색 색인(도로명·공원)."""

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(
        ForeignKey("network_versions.version", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String, index=True)
    category: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)  # 소속 자치구
    lon: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)


class StoredCourse(Base):
    """GET /v1/courses/{id}가 서버 재시작 뒤에도 같은 코스를 돌려주도록 보관."""

    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    purpose: Mapped[str] = mapped_column(String)
    route_type: Mapped[str] = mapped_column(String)
    data_version: Mapped[str] = mapped_column(String)
    algorithm_version: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"

    request_id: Mapped[str] = mapped_column(String, primary_key=True)
    request: Mapped[dict] = mapped_column(JSON)
    course_ids: Mapped[list] = mapped_column(JSON)
    elapsed_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
