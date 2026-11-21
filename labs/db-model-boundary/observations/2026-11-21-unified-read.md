# 세 모델 읽기 경로 통합 재측정 · 2026-11-21

## 조건

- PostgreSQL `18.6`, MongoDB `7.0.41`
- 주문 30,000건, 주문당 항목 5개
- 단일 Docker Host, DB Container별 CPU 2개·Memory 2GB, warm cache
- 모델별 100회 예열 후 1,000회 순차 호출을 5세트 실행
- 아래 값은 다섯 세트 평균값의 중앙값

`서버 밖 = Client 전체 - DB 서버 내부`다. PostgreSQL은
`pg_stat_statements`, MongoDB는 `serverStatus.opLatencies.reads`로 서버
시간을 관찰했으므로 서로 다른 계측 장치의 값을 절대적인 제품 순위로
일반화하지 않는다.

## 주문 1001 전체 조회

| 모델 | Client 전체 | 서버 내부 | 서버 밖 |
|---|---:|---:|---:|
| PostgreSQL 정규화 | 0.2645 ms | 0.0715 ms | 0.1930 ms |
| PostgreSQL JSONB | 0.1529 ms | 0.0193 ms | 0.1336 ms |
| MongoDB Document | 0.2692 ms | 0.0403 ms | 0.2289 ms |

- 정규화: PK Index Scan 3회, JOIN·Sort·Aggregate, Buffer hit 12
- JSONB: PK Index Scan 1회, Row 1개, Buffer hit 3
- MongoDB: `IDHACK`, Index Key 1개, Document 1개
- 세 모델 모두 physical/cache read 증가 `0`

## SKU-1033 주문 수 조회

| 모델 | Client 전체 | 서버 내부 | 서버 밖 |
|---|---:|---:|---:|
| PostgreSQL 정규화 | 0.1358 ms | 0.0254 ms | 0.1103 ms |
| PostgreSQL JSONB | 0.2499 ms | 0.1339 ms | 0.1160 ms |
| MongoDB Document | 0.2930 ms | 0.0893 ms | 0.2037 ms |

- 정규화: Index Only Scan, Index entry 75개, Buffer hit 5
- JSONB: GIN 후보 184개, Heap Row 75개, Buffer hit 86
- MongoDB: `COUNT_SCAN`, Index Key 76개, Document 0개
- 세 모델 모두 physical/cache read 증가 `0`

## 해석

한 주문 조회에서 정규화 SQL이 JSON을 조립한 이유는 세 모델이 한 번의 DB
요청으로 동일한 중첩 JSON 응답을 반환하도록 비교 조건을 맞추기 위해서다.
이는 정규화 모델의 필수 구현이 아니다. 애플리케이션에서 Flat Row를 조립하거나
여러 Query로 나누면 다른 실험이 된다. 이번 조건에서는 JSONB가 이미 조립된
Row 하나를 읽어 서버 경로가 가장 짧았다. JSONB와 MongoDB의 Client 차이
`0.116 ms` 중 서버 내부 차이는 `0.021 ms`, 서버 밖 차이는 `0.095 ms`였다.
SKU 조회에서는 정규화 모델이 주문 항목 Index만으로 답해 가장 짧았다.
MongoDB의 서버 내부 시간이 항상 가장 긴 것은 아니었고, 이 환경에서는 서버
밖 차이값이 더 컸다. 그 차이값을 Driver·BSON·Wire Protocol·Socket·Event
Loop 각각으로 분리하지 않았으므로 특정 요소 하나를 원인으로 단정하지 않는다.

저장 크기와 응답 시간도 직접 연결하지 않는다. MongoDB의 작은 `storageSize`는
WiredTiger Snappy 압축과 BSON·Page·Index 표현이 합쳐진 결과이고, 읽기 시간은
실행 경로와 Client 경계를 포함한 별도 관찰이다. Sharding·Failover·동시 사용자·
Cold cache는 측정하지 않았다.
