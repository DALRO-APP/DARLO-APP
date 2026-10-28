"""출발지·목적지 장소 검색.

카카오 REST 키(KAKAO_REST_API_KEY)가 있으면 카카오 로컬 키워드·주소 검색으로 전국 장소를 찾고,
없거나 실패하면 임포트한 용산구 도로명·공원 이름에서 찾는다. 결과마다 베타 서비스 범위
(용산구) 포함 여부와 실제로 출발할 도로 위 지점을 함께 준다. 앱은 범위 밖 장소를 고르면
베타 안내를 띄운다.
"""

import httpx

from .courses import PLACES
from .geo import haversine
from .graph import RoadGraph

KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
YONGSAN_CENTER = (126.9814, 37.5326)
START_SEARCH_RADIUS_M = 300  # 장소(건물 중심 등)에서 출발 도로를 찾는 반경
CATEGORY_ORDER = {"시연 장소": 0, "자치구": 1, "공원": 2, "도로": 3}


def _normalize(text: str) -> str:
    return "".join(text.split()).lower()


class PlaceSearch:
    def __init__(self, graph: RoadGraph, kakao_key: str | None, client: httpx.Client | None = None):
        self.graph = graph
        self.kakao_key = kakao_key
        self.client = client or httpx.Client(timeout=5.0)
        self.local = [(name, "시연 장소", "서울 용산구", position) for name, position in PLACES]
        self.local += graph.places

    def search(self, query: str, limit: int = 10) -> dict:
        notice = None
        found: list[dict] = []
        if self.kakao_key:
            try:
                found = self._kakao(query, limit)
            except (httpx.HTTPError, KeyError, ValueError):
                notice = "카카오 장소 검색에 실패해 서울 도로명·공원·자치구 이름에서 찾았어요."
        else:
            notice = "카카오 장소 검색이 꺼져 있어 서울 도로명·공원·자치구 이름에서 찾았어요."
        for item in self._local(query, limit):
            if all(item["name"] != f["name"] or haversine(item["position"], f["position"]) > 100 for f in found):
                found.append(item)
        places = [self._decorate(item) for item in found[:limit]]
        return {
            "query": query,
            "service_area": self.graph.service_area_name,
            "places": places,
            "notice": notice,
        }

    def _decorate(self, item: dict) -> dict:
        inside = self.graph.in_service_area(item["position"])
        start = self.graph.nearest_road_point(item["position"], START_SEARCH_RADIUS_M) if inside else None
        return {
            **item,
            "in_service_area": inside,
            "start_position": None if start is None else list(start[0]),
        }

    def _local(self, query: str, limit: int) -> list[dict]:
        key = _normalize(query)
        if not key:
            return []
        scored = []
        for name, category, address, position in self.local:
            target = _normalize(name)
            if key in target:
                # 일치 정도 → 베타 범위 안 → 장소 종류 → 짧은 이름 순
                rank = 0 if target == key else 1 if target.startswith(key) else 2
                outside = address != self.graph.service_area_name
                scored.append((rank, outside, CATEGORY_ORDER.get(category, 9), len(target), name, category, address, position))
        scored.sort()
        return [
            {
                "id": f"local:{category}:{name}",
                "name": name,
                "address": f"{address} · {category}",
                "category": category,
                "position": [round(position[0], 7), round(position[1], 7)],
                "source": "local",
            }
            for *_, name, category, address, position in scored[:limit]
        ]

    def _kakao(self, query: str, limit: int) -> list[dict]:
        headers = {"Authorization": f"KakaoAK {self.kakao_key}"}
        response = self.client.get(
            KAKAO_KEYWORD_URL,
            params={"query": query, "size": min(15, limit), "x": YONGSAN_CENTER[0], "y": YONGSAN_CENTER[1]},
            headers=headers,
        )
        response.raise_for_status()
        documents = response.json()["documents"]
        if documents:
            return [
                {
                    "id": f"kakao:{d['id']}",
                    "name": d["place_name"],
                    "address": d.get("road_address_name") or d.get("address_name") or "",
                    "category": d.get("category_group_name") or (d.get("category_name") or "").split(" > ")[-1],
                    "position": [float(d["x"]), float(d["y"])],
                    "source": "kakao",
                }
                for d in documents
            ]
        response = self.client.get(KAKAO_ADDRESS_URL, params={"query": query, "size": min(15, limit)}, headers=headers)
        response.raise_for_status()
        return [
            {
                "id": f"kakao-address:{d['x']},{d['y']}",
                "name": d["address_name"],
                "address": (d.get("road_address") or {}).get("address_name") or d["address_name"],
                "category": "주소",
                "position": [float(d["x"]), float(d["y"])],
                "source": "kakao",
            }
            for d in response.json()["documents"]
        ]
