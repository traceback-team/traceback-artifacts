# PostgreSQL 정규화·JSONB·MongoDB Document 비교 Lab

`DB-NOSQL-01` 발표의 세 번째 질문을 실제 실행으로 검증합니다. 같은 주문을
PostgreSQL 정규화 Table, PostgreSQL JSONB Row, MongoDB Embedded Document에
넣고 동일한 접근 패턴을 측정합니다.

## 고정 Runtime

- PostgreSQL `18.6`
- MongoDB Community Server `7.0.41`
- Node.js `24.11.1`
- `pg` Driver `8.16.3`
- MongoDB Node.js Driver `7.9.0`

두 Database Container는 각각 CPU 2개와 Memory 2GB로 제한합니다. 기본 실행은
주문 30,000건과 주문당 항목 5개를 생성합니다.

## 실행

```sh
docker compose up -d postgres mongo replica-init
docker compose run --rm --build benchmark
docker compose down
```

완전히 새 Volume에서 재현할 때만 다음 명령으로 기존 실험 데이터를 삭제합니다.

```sh
docker compose down --volumes
```

결과는 `results/results.json`에 기록됩니다. 이 결과는 한 개발용 Docker Host의
warm-cache 단일 Node 관찰값입니다. 제품 전체의 우열이나 Sharding·고가용성
성능으로 일반화하지 않습니다.

`diagnostics.mongoAggregateReadBoundary`는 같은 MongoDB `_id` 조회를 5,000회
반복하고 Client 경과 시간과 `serverStatus.opLatencies.reads`의 증가분을
비교합니다. 이를 통해 서버 내부 조회 시간과 Driver·BSON·Socket·Event Loop를
포함한 서버 밖 경계 시간을 구분합니다. 서버 밖 시간을 그 네 요소로 다시
나누는 실험은 아닙니다.

`diagnostics.skuReadBoundary`는 JSONB와 MongoDB의 SKU 주문 수 조회를 각각
1,000회씩 5세트 실행합니다. PostgreSQL은 `pg_stat_statements`, MongoDB는
`serverStatus.opLatencies.reads`로 서버 내부 시간과 Client 전체 시간을
분리하고, 두 엔진의 cache read 증가량도 함께 기록합니다.
