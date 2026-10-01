# DALRO 작업 하네스

참고: 돈가스 지도 Dev/.codex의 작업 문서·훅·명령 정책 구조. 이 레포는 운영 서버가 없는 프론트엔드 데모이므로 운영 DB 승인 게이트와 호환성 에이전트는 가져오지 않았습니다.

- 루트 `AGENTS.md`: 자동 탐색되는 작업 규칙의 단일 원본.
- `.codex/AGENTS.md`: 루트 문서 안내. 중복 본문 동기화가 필요하지 않습니다.
- `.codex/config.toml`: 프로젝트 hooks 활성 설정. 전역 모델·권한·sandbox를 바꾸지 않습니다.
- `.codex/hooks.json`: PreToolUse(Bash) 명령 가드. exec_command도 공식 문서상 Bash 별칭으로 매칭됩니다.
- `.codex/hooks/command-guard.cjs`: 흔한 파괴 명령을 차단하는 보조 가드. shell 전체 파서를 구현한 보안 경계가 아닙니다.
- `.codex/rules/dalro.rules`: 원격/파괴 명령 정책. 훅과 별도 계층입니다.
- `npm run check`: 타입·lint·계약/저장소·전달 자료·훅 검사.
- `.github/workflows/check.yml`: 위 검사와 세 플랫폼 JS export, 웹 시연 E2E.

로컬 Codex에서 **프로젝트 신뢰와 훅 신뢰**가 필요합니다. CLI `/hooks`에서 정의를 검토한 뒤 신뢰하고 새 세션에서 적용을 확인하세요. 이 작업은 구성과 독립 검사를 수행했으며 현재 대화 런타임 자동 실행까지 확인한 것은 아닙니다. 지원되지 않는 클라이언트/클라우드 실행에서는 루트 작업 규칙과 npm 검증을 사용합니다. 훅 오류·timeout·우회 가능한 shell 문법까지 완벽히 차단하지 못합니다.

공식 근거: [Codex Hooks](https://learn.chatgpt.com/docs/hooks). 비관리 훅의 신뢰 검토, project layer, Bash 별칭, PreToolUse deny 출력 형식을 기준으로 작성했습니다. 설정 파일에 위험 명령을 테스트했다고 실제 위험 명령을 실행한 것은 아닙니다.
