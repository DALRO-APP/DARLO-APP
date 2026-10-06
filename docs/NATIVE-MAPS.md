# 아이폰·Android 카카오 지도 개발 앱

웹은 JavaScript SDK를 사용하고 모바일은 공식 Kakao Maps SDK를 로컬 Expo 모듈로 연결한다. **Native 키를 입력해도 Expo Go에 SDK가 추가되지는 않는다.** 별도로 빌드한 DALRO 앱이 필요하다. 지금은 연결 코드·빌드 준비 검증까지 완료했으며 native 컴파일·실기 인증/렌더링은 아직 검증하지 않았다.

## 아이폰 등록과 환경

카카오 Developers → 앱 → 플랫폼 키 → Native 키 수정 → **iOS 번들 ID: `com.dalro.app`** → 저장. 카카오맵 사용 설정도 확인한다. 웹 허용 도메인은 이 native 인증을 대신하지 않는다. 스토어 ID는 출시 전 로컬 개발 설치에 필요하지 않다.

git에서 제외된 `.env.local`에 Native 키를 설정한다. 전달받은 실제 값은 이 컴퓨터의 로컬 파일에만 저장했다.

```dotenv
EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY=YOUR_NATIVE_APP_KEY
```

빌드 시 이 값은 앱이 사용하는 식별자로 번들에 포함된다. 서버 비밀키·관리자 키를 넣지 않는다. EAS의 원격 빌드에는 `.env.local`이 git 제외되므로 EAS 환경변수에 같은 값을 별도로 설정해야 한다.

## 아이폰에 로컬 설치

1. Mac App Store에서 **전체 Xcode**를 설치하고 한 번 열어 초기 구성/iOS SDK 설치를 마친다. Command Line Tools만으로는 아이폰 앱을 컴파일할 수 없다.
2. Xcode Settings → Accounts에 Apple ID를 추가한다. 로컬 실기 설치는 무료 Apple ID로 가능하며 서명 프로비저닝은 갱신이 필요할 수 있다.
3. 아이폰을 케이블로 연결하고 신뢰 허용 및 개발자 모드를 활성화한다.
4. 프로젝트에서 실행한다.

   ```sh
   npm ci
   npm run check:native -- ios
   npm run ios:device
   ```

5. Apple 개발 팀을 선택해 서명한다. 필요하면 생성된 `ios/DALRO.xcworkspace`를 Xcode로 열고 Signing & Capabilities에서 Team을 지정한다. 번들 ID가 변경되면 카카오 등록 값도 변경한다.
6. 설치된 **DALRO 앱**을 연다. 이후 JS 수정은 아래 개발 서버로 확인한다.

   ```sh
   npm run start:dev
   ```

Native 소스/의존성을 수정하면 앱을 다시 빌드한다. `expo start`나 JS export만으로 변경된 SDK가 설치되지 않는다.

## EAS 클라우드에서 아이폰 설치 앱 생성

이 경로는 Expo 계정, 유료 Apple Developer 계정, 기기 등록 및 개발 서명이 필요하다. `eas.json`에 internal development 프로필과 simulator 프로필을 준비했다. 클라우드 빌드는 아직 실행하지 않았다.

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment development --name EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY --visibility plaintext
# 키 값은 대화형 입력. 원격 빌드 환경에는 로컬 .env.local이 자동 전달되지 않음.
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile development
```

다운로드 링크로 등록한 아이폰에 DALRO 개발 앱을 설치한 뒤 `npm run start:dev`에 연결한다. `development-simulator` 결과는 Mac 시뮬레이터용이며 아이폰에 설치할 수 없다.

## Android

카카오 Native 키에 **패키지명 `com.dalro.app`** 및 실제 빌드 인증서의 **키 해시**를 등록한다. Android Studio/JDK/SDK가 준비되면 다음 순서를 따른다.

```sh
npx expo prebuild --platform android --no-install
npm run check:native -- android
npm run android:device
```

환경 검사 스크립트가 로컬 `android/app/debug.keystore`의 SHA-1 인증서 해시를 Base64로 출력한다. 이는 SHA-256 지문 문자열과 다르다. EAS/배포 서명은 로컬 debug 서명과 다를 수 있으므로 설치 앱의 서명을 기준으로 등록한다. 개인정보 위치/GPS 권한은 아직 요청하지 않는다. 모의 러너 표시에는 위치 권한이 필요하지 않다.

## 연결 기능과 검증 한계

- 후보 코스 선·선택 코스 강조·출발/도착·보간된 모의 러너 표시를 구현했다. 후보 선택은 지도 아래 코스 버튼과 기존 카드로 한다. native 지도 선 직접 클릭은 현재 제공하지 않는다.
- 지도 이동/확대가 가능하며 앱의 확대 버튼은 전체 후보/선택 코스의 범위를 맞춘다. 진행률 변경 시 카메라를 계속 되돌리지 않는다.
- 화면 비활성/백그라운드에서는 엔진을 일시 정지하고 뷰 해제 시 리소스를 종료한다. 인증 실패·타임아웃은 오류/재시도/사용자가 선택하는 도식 지도 버튼으로 처리한다.
- 키가 없으면 도식 지도. Native 키가 있는 Expo Go에는 개발 앱 설치 안내를 표시한다. 가짜 배경을 실제 카카오 인증 성공으로 표현하지 않는다.
- 코스는 도로/건물/강을 피하는 실제 추천 결과가 아니며 환경값·주행은 시연용이다. 웹/모바일 모두 같은 서버 GeoJSON 계약을 사용한다.

SDK는 Android `2.15.2`, iOS `2.12.0`으로 고정했다. Android는 공개 AAR의 메서드 선언, iOS는 실제 배포 xcframework의 Swift 인터페이스와 소스를 대조했다. 이는 전체 앱 컴파일을 대신하지 않는다. 후속 SDK 업그레이드도 실제 플랫폼 빌드를 검증한다.

GitHub Actions의 `iOS native build`는 Mac에서 CocoaPods 설치 후 앱과 지도 모듈을 iOS 시뮬레이터용으로 컴파일한다. Apple 서명과 실제 키 없이 실행하며, 이 검사에 통과해도 아이폰 설치·카카오 인증·실기 렌더링은 별도로 확인해야 한다. 빌드 로그는 Actions artifact로 남긴다.

2026-10-01 검사 결과: Expo SDK 57 의존성 검사, TypeScript/lint, 단위 테스트 16개, 웹 E2E 10개, 세 플랫폼 JS export, native prebuild(`--no-install`), 양 플랫폼 모듈 자동 연결, Swift 구문/Ruby podspec 검사 통과. Mac에는 전체 Xcode/iPhoneOS SDK와 Android SDK가 없어 pod install·native 컴파일·IPA/APK 생성·실기 렌더링은 완료하지 못했다. `check:native`는 이 환경 부족을 실패로 표시한다.

- [Expo 개발 빌드·아이폰 설치](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Go의 native 라이브러리 제한](https://docs.expo.dev/develop/development-builds/faq/)
- [로컬 Expo 모듈](https://docs.expo.dev/modules/get-started/)
- [Kakao iOS 사용 등록](https://apis.map.kakao.com/ios_v2/docs/getting-started/basics/02_auth/)
- [Kakao Android SDK 시작](https://apis.map.kakao.com/android_v2/docs/getting-started/quickstart/)

## 2026-10-06 출발·도착 마커 변경

Loop/Straight 화면을 분리하면서 JS의 `routesJson` 각 코스에 `end`를 추가했습니다. Loop와 남은 구간은 `null`, Straight는 전체 경로의 마지막 좌표 `{ latitude, longitude }`를 보냅니다. iOS와 Android 로컬 모듈이 선택된 Straight의 도착 마커를 표시합니다. 주행한 구간이 짧아져도 목적지는 고정됩니다. `RouteMapProps`는 유지합니다.

이 변경은 native 소스를 포함하므로 기존 개발 앱에서는 새 마커가 적용되지 않습니다. **개발 앱을 다시 빌드해야 합니다.** 이번 환경에서는 preflight 결과 Xcode/iPhoneOS SDK와 Android SDK 경로가 준비되지 않아 플랫폼 컴파일·실기 렌더링을 확인하지 못했습니다. 웹 및 native JS export 성공은 네이티브 컴파일 성공을 의미하지 않습니다.
