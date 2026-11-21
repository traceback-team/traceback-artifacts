# MongoDB 7.0.41 계층·저장 경계 관찰 환경

NoSQL 문서형 DB의 전체 요청 경로를 MongoDB 한 버전에서 재현합니다.

- Node.js 객체를 MongoDB Node.js Driver 7.9.0으로 BSON 직렬화
- Driver command monitoring으로 실제 Server Command 경계 관찰
- Collection validator, Compound Index, `explain("executionStats")` 확인
- 단일 Node Replica Set에서 두 Document를 바꾸는 Transaction Commit
- MongoDB Frontend의 논리 Metadata와 WiredTiger의 Cache·파일·Journal 관찰

이 환경은 외부 인증과 고가용성을 생략한 로컬 학습용입니다. 호스트 포트
`127.0.0.1:57017`만 열며, “운영에 적합한 단일 Node Replica Set”을 제안하지 않습니다.

## 실행

```sh
./verify.sh
```

Runtime은 다음 버전으로 고정합니다.

- MongoDB Community Server `7.0.41` (`mongo:7.0.41-jammy`)
- MongoDB Node.js Driver `7.9.0`
- Node.js `24.11.1`

`verify.sh`는 Client Image를 Build하고 MongoDB를 시작한 뒤 실제 Image digest,
Server `gitVersion`, Wire Version, BSON 크기, Query Plan, Transaction Command,
WiredTiger Cache 통계와 `/data/db` 파일을 출력합니다. 관찰 결과의 요약은
`observations/2026-11-18.md`에 있습니다.

처음 고정했던 `8.0.30-noble`과 최신 수정판 `8.0.38-noble`은 2026-11-18
현재 Docker Desktop VM의 Kernel `7.0.12-linuxkit`을 `SERVER-121912` 영향
범위(`6.19.0`–`7.0.13`)로 판단해 시작을 거부했습니다. 호스트가 아니라 Docker
VM Kernel 때문에 생긴 실패입니다. 그래서 해당 제한에 걸리지 않으면서 이
실험의 BSON·Index·Transaction·WiredTiger 기능을 모두 지원하는 이전 안정 계열
`7.0.41`을 실제 검증 버전으로 고정했습니다. MongoDB 8.0 전용 동작은 이
실험 결과로 주장하지 않습니다.

## 종료와 초기화

```sh
docker compose down
docker compose down --volumes
```

두 번째 명령은 이름 있는 Volume의 학습 데이터를 삭제합니다. 완전히 새 관찰을
시작할 때만 실행하세요.
