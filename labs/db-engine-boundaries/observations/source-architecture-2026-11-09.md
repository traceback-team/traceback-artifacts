# Source Module Architecture 관찰 기록

`./fetch-sources.sh`와 `./inspect-sources.sh`를 Source Inspector Container 안에서
실행한 결과입니다.

## 확인한 Revision

- PostgreSQL `REL_18_6`: `724edf9bde9d356724ad384a2e196edc3c9f80f7`
- MySQL `mysql-8.4.13`: `8a180268d832300c09a375115dfa0ea77d83f1af`

Runtime Image의 출력 버전과 같은 Release Tag를 사용했습니다. Source는 Docker
Volume에 Sparse Checkout했고 Workspace에는 전체 Source Tree를 복사하지 않았습니다.

## PostgreSQL: Tree는 하나의 공통 Struct가 아니다

모든 Node는 `NodeTag type`을 첫 필드로 갖는 `Node` 계열이지만 단계별 Root와
필드는 서로 다릅니다.

```text
Raw Parse Tree   UpdateStmt   parsenodes.h:2133
Query Tree       Query        parsenodes.h:117
Planner 후보     RelOptInfo   pathnodes.h:883
                 Path         pathnodes.h:1753
Plan Tree        Plan         plannodes.h:158
                 ModifyTable  plannodes.h:281
Executor State   PlanState    execnodes.h:1149
```

- `UpdateStmt`는 `RangeVar *relation`, `List *targetList`, `Node *whereClause`를 가집니다.
- `Query`는 `List *rtable`, `FromExpr *jointree`와 분석된 명령 정보를 가집니다.
- `Path`는 예상 Row와 Cost, 부모 `RelOptInfo` 등 후보 경로 정보를 가집니다.
- `Plan`은 Cost와 `targetlist`, `qual`, 자식 Plan 링크를 가집니다.
- `PlanState`는 원래 `Plan *`, 실행 함수 `ExecProcNode`, 좌우 `PlanState *`와
  Tuple Slot 등 Runtime 상태를 가집니다.

따라서 Raw Parse Tree만 AST라고 부르는 것이 정확합니다. Query·Path·Plan·PlanState는
모두 Node 연결을 사용하지만 각각 의미, 후보 탐색, 실행 지시, 실행 상태라는 다른
추상화입니다. Rewrite 결과는 별도의 `RewrittenQuery` Struct가 아니라 `Query` 계열을
수정·추가·대체한 결과입니다.

## PostgreSQL: AM은 공용 Module 사이의 좁은 Callback 경계

확인한 주요 Source Folder는 다음과 같습니다.

```text
src/backend/parser/
src/backend/rewrite/
src/backend/optimizer/{path,plan,prep,util}/
src/backend/executor/
src/backend/access/{table,index,heap,nbtree,transam}/
src/backend/storage/{buffer,lmgr,smgr,page}/
src/include/access/{tableam.h,amapi.h}
```

`TableAmRoutine`은 `scan_begin`, `index_fetch_begin`, `tuple_insert`,
`tuple_update`, `tuple_delete` 같은 Table 접근 Callback을 가집니다.
`IndexAmRoutine`은 `ambuild`, `aminsert`, `ambeginscan`, `amgettuple`,
`amgetbitmap` 같은 Index Callback을 가집니다.
Heap 구현은 `access/heap/heapam_handler.c:2616`의 `heapam_methods`, B-tree 구현은
`access/nbtree/nbtree.c:115`의 `bthandler()`가 해당 Routine을 구성하는 것도
확인했습니다.

실제 UPDATE 연결도 확인했습니다.

```text
src/backend/executor/nodeModifyTable.c:2303
  → table_tuple_update(...)
  → Relation의 TableAmRoutine.tuple_update Callback
```

Transaction/WAL은 `access/transam`, Buffer·Lock·Storage Manager는 `storage/*`에
AM 구현과 나란히 분리돼 있습니다. 즉 PostgreSQL의 AM 경계는 PostgreSQL 전체
Transaction·Buffer·WAL을 하나의 교체 Package로 묶는 경계가 아닙니다.

## MySQL: Handler가 Server와 Storage Engine을 잇는다

확인한 주요 Source Folder는 다음과 같습니다.

```text
sql/{sql_parse,sql_optimizer,sql_executor,sql_update,handler}.*
storage/innobase/handler/
storage/innobase/{btr,buf,row,trx,lock,log}/
```

`sql/handler.h`에는 두 층의 경계가 있습니다.

- `handlerton`: Engine 단위의 `commit`, `rollback`, `prepare`, `recover`,
  `create`, `drop_database`, `flush_logs` Callback
- `handler`: 열린 Table 단위의 Row·Index 접근 Interface와 해당 Engine을 가리키는
  `handlerton *ht`

InnoDB Adapter `ha_innobase : public handler`는 `open`, `write_row`,
`update_row`, `delete_row` 등을 Override합니다. 실제 UPDATE 연결도 확인했습니다.

```text
sql/sql_update.cc:1000
  → table->file->ha_update_row(...)
sql/handler.cc:8118
  → handler::ha_update_row(...)
storage/innobase/handler/ha_innodb.cc:10003
  → ha_innobase::update_row(...)
```

그 아래에 InnoDB 소유의 B-tree(`btr`), Buffer Pool(`buf`), Row(`row`),
Transaction(`trx`), Lock(`lock`), Redo Log(`log`) Module이 함께 있습니다.

## 검증된 구조 차이

PostgreSQL과 MySQL 모두 Callback Interface를 사용합니다. 차이는 Callback의 존재
여부가 아니라 **그 Interface 아래에 무엇을 한 Module 경계로 묶었는지**입니다.

- PostgreSQL Table/Index AM 아래에는 Table·Index 접근 구현이 있고 Transaction,
  Buffer, WAL, Lock은 PostgreSQL 공용 Module로 분리돼 있습니다.
- MySQL Handler 아래의 InnoDB Folder에는 Table/Index뿐 아니라 Buffer, Transaction,
  Lock, Log Module까지 함께 들어 있습니다.

이 관찰이 “PostgreSQL은 아무것도 확장할 수 없다”는 뜻은 아닙니다. MySQL의
Storage Engine과 PostgreSQL의 Table/Index AM이 서로 다른 폭의 추상화 경계라는
뜻입니다.
