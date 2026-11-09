# PostgreSQL 18 · MySQL 8.4/InnoDB 경계 관찰 환경

DB-ENGINE-02의 제품 구조 설명을 로컬에서 재현하기 위한 Docker Compose 환경입니다.
두 서버에 같은 `accounts` 테이블과 `id = 7` 행을 만들고 다음 사실을 관찰합니다.

- PostgreSQL이 노출하는 Table/Index Access Method와 기본 `heap` 연결
- MySQL이 노출하는 Storage Engine 목록과 테이블별 `ENGINE` 연결
- MySQL에서 한 Probe Table을 InnoDB에서 MyISAM으로 바꾸는 동작
- 두 제품의 PID 1 실행 파일과 데이터 디렉터리에 생긴 물리 파일

이 실험은 “모든 PostgreSQL 확장이 불가능하다”거나 “InnoDB가 별도 프로세스다”라는
주장을 증명하지 않습니다. 관찰 가능한 SQL Catalog, Process, File 경계만 기록합니다.

## 실행

Docker Desktop을 시작한 뒤 이 디렉터리에서 실행합니다.

```sh
docker compose up -d --wait
./verify.sh
```

## 정확한 Source Tag 검사

Runtime Image의 버전에 맞춘 PostgreSQL·MySQL 공식 Source를 별도 Inspector
Container의 이름 있는 Volume에 Sparse Checkout합니다. 호스트 Workspace에는 전체
Source Tree를 복사하지 않습니다.

```sh
./fetch-sources.sh
./inspect-sources.sh
```

- PostgreSQL `REL_18_6`: `724edf9bde9d356724ad384a2e196edc3c9f80f7`
- MySQL `mysql-8.4.13`: `8a180268d832300c09a375115dfa0ea77d83f1af`

검사 대상은 Parser/Tree Node, Planner/Executor, PostgreSQL Table·Index AM,
MySQL Handler API와 InnoDB Adapter·하위 저장 Module입니다.

호스트 연결 포트는 기존 DB와 충돌을 줄이기 위해 PostgreSQL `55432`, MySQL
`53306`으로 제한했으며 두 포트 모두 `127.0.0.1`에만 Bind됩니다. 계정과 비밀번호는
외부 사용을 위한 Secret이 아니라 이 로컬 실습 전용 고정값입니다.

## 초기화와 종료

초기화 SQL은 이름 있는 Volume이 처음 만들어질 때만 실행됩니다.

```sh
docker compose down
docker compose down --volumes
```

두 번째 명령은 실습 데이터를 삭제하고 완전히 새로 초기화할 때만 사용하세요.
