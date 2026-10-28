import type { Place, PlaceSearchResponse } from "../domain/contracts";
import { STARTS } from "../domain/catalog";

// mock 모드의 장소 검색용 고정 목록. 좌표는 대략값이며, 범위 포함 여부와 출발 도로 지점은
// server/ 임포트 자료(용산구 행정경계·도로망)로 계산했다. 실제 검색은 서버를 사용한다.
const inside = (
  name: string,
  category: string,
  position: Place["position"],
  start: Place["position"],
): Place => ({
  id: `demo:${name}`,
  name,
  address: `서울 용산구 · ${category}`,
  category,
  position,
  start_position: start,
  in_service_area: true,
  source: "local",
});
const outside = (
  name: string,
  district: string,
  category: string,
  position: Place["position"],
): Place => ({
  id: `demo:${name}`,
  name,
  address: `서울 ${district} · ${category}`,
  category,
  position,
  start_position: null,
  in_service_area: false,
  source: "local",
});

export const DEMO_PLACES: Place[] = [
  ...STARTS.map((s) =>
    inside(s.label, "시연 장소", s.coordinate, s.coordinate),
  ),
  inside("용산역", "기차역", [126.9648, 37.5299], [126.965158, 37.529265]),
  inside("이태원역", "지하철역", [126.9946, 37.5345], [126.9946, 37.5345]),
  inside("삼각지역", "지하철역", [126.9731, 37.5347], [126.973032, 37.534738]),
  inside("국립중앙박물관", "박물관", [126.9803, 37.524], [126.9805, 37.524288]),
  inside("효창공원", "공원", [126.9614, 37.5447], [126.961392, 37.544681]),
  inside("한남역", "지하철역", [127.0093, 37.5294], [127.009366, 37.529296]),
  inside("숙대입구역", "지하철역", [126.972, 37.5448], [126.971941, 37.544789]),
  inside("녹사평역", "지하철역", [126.9875, 37.5345], [126.987458, 37.534477]),
  inside("서빙고역", "지하철역", [126.9883, 37.5197], [126.988285, 37.519904]),
  outside("강남역", "강남구", "지하철역", [127.0276, 37.4979]),
  outside("여의도한강공원", "영등포구", "공원", [126.9327, 37.5284]),
  outside("홍대입구역", "마포구", "지하철역", [126.9245, 37.5572]),
  outside("서울숲", "성동구", "공원", [127.0374, 37.5444]),
  outside("광화문", "종로구", "명소", [126.9768, 37.5759]),
];

const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();

export function searchDemoPlaces(query: string): PlaceSearchResponse {
  const key = normalize(query);
  return {
    query,
    service_area: "서울 용산구",
    places: key
      ? DEMO_PLACES.filter((p) => normalize(p.name).includes(key))
      : [],
    notice: "시연 모드라 용산구 주요 장소와 일부 서울 장소만 검색돼요.",
  };
}
