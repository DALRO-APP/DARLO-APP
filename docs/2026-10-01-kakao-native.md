# 2026-10-01 모바일 네이티브 카카오 지도

요청: Native 키를 이용해 모바일 지도 연결. 시연 기기는 아이폰.

결정: Expo SDK 57의 로컬 Expo Modules API로 공식 Kakao SDK를 연결한다. 조사한 `@react-native-kakao/map` 공개 버전은 코스 선 API가 없고 오래된 core 버전에 묶여 있어 앱 코스 표시에 쓰지 않았다. WebView로 Native SDK 연결을 대신하지 않는다. 웹 공급자는 유지한다.

`RouteMapProps`/서버 계약을 그대로 유지하며 JSON 좌표 필드는 latitude/longitude로 명시한다. native에는 후보 선·선택 강조·출발/도착·모의 진행률 보간·범위 카메라·실패 재시도·화면/앱 라이프사이클을 추가했다. 지도 아래 버튼으로 후보를 선택한다. native 선 클릭은 구현하지 않았다. 모의 주행과 실제 GPS를 구분한다.

Native 앱 식별자는 양 플랫폼 `com.dalro.app`. 실제 키는 git 제외 로컬 환경에만 보관한다. Expo Go에 추가 SDK를 넣을 수 없으므로 설치 안내를 제공하고, 원하면 도식 시연 지도로 전환한다. 개발 앱용 Expo 의존성, EAS 프로필, 실기 설치 명령 및 환경 검사도 추가했다.

검증: 단위 16개·웹 E2E 10개·세 플랫폼 JS export·의존성·prebuild·자동 연결·Swift 구문 및 podspec 검사 통과. 실제 SDK 배포 아티팩트의 API도 대조했다. 전체 Xcode 및 Android SDK가 없어 native 컴파일/서명/실기 렌더링은 미검증이다. 아이폰 빌드에는 카카오 번들 ID 등록 및 Xcode/Apple 서명 또는 EAS/유료 Apple 계정 설정이 남았다. 절차는 [native 설치 안내](NATIVE-MAPS.md)에 기록한다.
