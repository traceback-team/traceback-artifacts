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
