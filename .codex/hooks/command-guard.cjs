const rules = [
  [/\bgit\s+(?:[^\n;&|]*?\s)?reset\s+--hard\b/, '작업 변경을 버리는 git reset --hard를 차단합니다.'],
  [/\bgit\s+clean\s+[^\n;&|]*-[^\s]*f/, '추적하지 않은 파일을 삭제하는 git clean을 차단합니다.'],
  [/\bgit\s+push\b[^\n;&|]*(--force(?:-with-lease)?\b|-f\b)/, '강제 push를 차단합니다.'],
  [/\brm\s+[^\n;&|]*(?:\s|^)(?:\/|\/\*|~\/?|\$HOME|\$\{HOME\})(?:\s|$)/, '루트·홈 삭제를 차단합니다.'],
  [/\bprisma\b[^\n;&|]*(?:migrate\s+reset|db\s+execute|--force-reset|--accept-data-loss)/, '이 프론트엔드에서 DB 파괴/직접 SQL 명령을 차단합니다.'],
];
function reasonFor(command) { return rules.find(([pattern]) => pattern.test(command))?.[1] ?? null; }
module.exports = { reasonFor };
if (require.main === module) {
  let input = '';
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(input);
      const command = payload?.tool_input?.command ?? payload?.tool_input?.cmd;
      if (typeof command !== 'string') throw new Error('command 필드가 없습니다.');
      const reason = reasonFor(command);
      if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
    } catch {
      process.stderr.write('DALRO guard: 잘못된 hook 입력입니다.');
      process.exitCode = 2;
    }
  });
}
