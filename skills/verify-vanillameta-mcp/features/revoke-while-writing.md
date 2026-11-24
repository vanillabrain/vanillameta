# Refuse a write while the connection is being revoked

## Sub-features
A write checks the grant and commits in one transaction. It locks the user row first and the grant row second, the same order as disconnect. A disconnect that is in progress makes the write wait, then refuses it. No row is created.

## How to get to it (user POV)
The person clicks Disconnect on the AI connection while the AI host is still writing.

## Driving it with psql and curl
Step 7 of `scripts/verify/mcp-artifacts-e2e.sh`. It holds the revoke transaction open for 10 seconds, sends `vm_create_artifact` during that time, and then compares row counts.

The proof is these lines, in order: `해제할 활성 연결이 1 개 있음`, `연결 해제 트랜잭션이 잠금을 쥐고 있음`, `해제 트랜잭션이 연결 1 개를 실제로 해제함`, `쓰기가 잠금이 풀릴 때까지 <n>초 기다림`, `해제 중인 연결의 쓰기가 권한 오류로 거절됨`, `해제된 연결로 행이 생기지 않음(0 → 0)`, `해제 뒤 토큰이 401 로 거절됨`. The write waited at least 2 seconds. The response text is `race-response.json`.

## Gotchas
- Develop code before this change reports success and creates the row. The script of that time, run against that code, gave PASS=61 FAIL=2. The two failures were the write response and the row count. The wait line was added later and has not been run against that code.
- The probe needs one active grant. With none, the first line fails and the lines after it prove nothing.
- Do not write through the same account while the probe runs.
