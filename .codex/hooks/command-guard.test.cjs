const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { reasonFor } = require('./command-guard.cjs');
for (const command of ['git reset --hard', 'git clean -fdx', 'git push origin main --force', 'git push -f', 'rm -rf /', 'rm -rf "$HOME"'.replaceAll('"',''), 'npx prisma migrate reset', 'npx prisma db push --accept-data-loss']) assert.ok(reasonFor(command), command);
for (const command of ['npm run check', 'npm ci', 'git status --short', 'git diff', 'rg --files', 'rm /tmp/dalro-slide7.png', 'node --import tsx scripts/validate-data.ts examples/data']) assert.equal(reasonFor(command), null, command);
const denied = spawnSync(process.execPath, [require.resolve('./command-guard.cjs')], { input: JSON.stringify({ tool_input: { command: 'git reset --hard' } }), encoding: 'utf8' });
assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny');
const bad = spawnSync(process.execPath, [require.resolve('./command-guard.cjs')], { input: '{', encoding: 'utf8' }); assert.equal(bad.status, 2);
console.log('PASS · 위험 명령/허용 명령/훅 JSON/잘못된 입력 검사');
