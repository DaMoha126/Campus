# Étudia — isolated capacity benchmark

Isolated temporary local PocketBase; fictitious data only

Two establishments × 1,600 fictitious pupils; no requests to a public service.

Seed: 36826 ms. SQLite: 30822400 bytes.

## Created volumes

```json
{
  "establishments": 2,
  "school_users": 3222,
  "classes": 80,
  "subjects": 20,
  "enrollments": 3200,
  "evaluations": 2400,
  "school_grades": 96000,
  "attendance": 3200,
  "payments": 3200
}
```

Correctness passed: true. Indicative performance references met: false.

Scoped-screen performance references met: false. Full/export measurements remain separate in the table.

Disposable-server recovery restarts after a stopped workload: 4

Authentication backoffs (outside measurements, rate limits retained): 10

## Correctness
- PASS production rate limits retained
- PASS two isolated schools seeded
- PASS seed volumes exact
- PASS school 1 teacher isolation: {"status":200,"counts":{"people":1602,"classes":40,"assignments":40,"enrollments":1600,"evaluations":120,"grades":4800,"attendance":1600,"payments":0}}
- PASS School 1 administrator full concurrency 1 status/counts/isolation
- PASS School 1 administrator full concurrency 5 status/counts/isolation
- PASS School 1 administrator full concurrency 10 status/counts/isolation
- PASS School 1 administrator overview concurrency 1 status/counts/isolation
- PASS School 1 administrator overview concurrency 5 status/counts/isolation
- PASS School 1 administrator overview concurrency 10 status/counts/isolation
- PASS School 1 administrator overview concurrency 50 status/counts/isolation
- PASS School 1 administrator overview concurrency 100 status/counts/isolation
- PASS School 1 administrator reports concurrency 1 status/counts/isolation
- PASS School 1 administrator reports concurrency 5 status/counts/isolation
- PASS School 1 administrator reports concurrency 10 status/counts/isolation
- PASS School 1 administrator reports concurrency 50 status/counts/isolation
- PASS School 1 student full concurrency 1 status/counts/isolation
- PASS School 1 student full concurrency 5 status/counts/isolation
- PASS School 1 student full concurrency 10 status/counts/isolation
- PASS School 1 student overview concurrency 1 status/counts/isolation
- PASS School 1 student overview concurrency 5 status/counts/isolation
- PASS School 1 student overview concurrency 10 status/counts/isolation
- PASS School 1 student overview concurrency 50 status/counts/isolation
- PASS School 1 student overview concurrency 100 status/counts/isolation
- PASS School 1 student reports concurrency 1 status/counts/isolation
- PASS School 1 student reports concurrency 5 status/counts/isolation
- PASS School 1 student reports concurrency 10 status/counts/isolation
- PASS School 1 student reports concurrency 50 status/counts/isolation
- PASS School 1 student reports concurrency 100 status/counts/isolation
- PASS school 1 attendance write 1
- PASS school 1 attendance write 2
- PASS school 1 attendance write 3
- PASS school 1 attendance write 4
- PASS school 1 attendance write 5
- PASS school 1 foreign school query empty
- PASS school 1 foreign school attendance write denied
- PASS school 2 teacher isolation: {"status":200,"counts":{"people":1602,"classes":40,"assignments":40,"enrollments":1600,"evaluations":120,"grades":4800,"attendance":1600,"payments":0}}
- PASS School 2 administrator full concurrency 1 status/counts/isolation
- PASS School 2 administrator full concurrency 5 status/counts/isolation
- PASS School 2 administrator full concurrency 10 status/counts/isolation
- PASS School 2 administrator overview concurrency 1 status/counts/isolation
- PASS School 2 administrator overview concurrency 5 status/counts/isolation
- PASS School 2 administrator overview concurrency 10 status/counts/isolation
- PASS School 2 administrator overview concurrency 50 status/counts/isolation
- PASS School 2 administrator overview concurrency 100 status/counts/isolation
- PASS School 2 administrator reports concurrency 1 status/counts/isolation
- PASS School 2 administrator reports concurrency 5 status/counts/isolation
- PASS School 2 administrator reports concurrency 10 status/counts/isolation
- PASS School 2 administrator reports concurrency 50 status/counts/isolation
- PASS School 2 student full concurrency 1 status/counts/isolation
- PASS School 2 student full concurrency 5 status/counts/isolation
- PASS School 2 student full concurrency 10 status/counts/isolation
- PASS School 2 student overview concurrency 1 status/counts/isolation
- PASS School 2 student overview concurrency 5 status/counts/isolation
- PASS School 2 student overview concurrency 10 status/counts/isolation
- PASS School 2 student overview concurrency 50 status/counts/isolation
- PASS School 2 student overview concurrency 100 status/counts/isolation
- PASS School 2 student reports concurrency 1 status/counts/isolation
- PASS School 2 student reports concurrency 5 status/counts/isolation
- PASS School 2 student reports concurrency 10 status/counts/isolation
- PASS School 2 student reports concurrency 50 status/counts/isolation
- PASS School 2 student reports concurrency 100 status/counts/isolation
- PASS school 2 attendance write 1
- PASS school 2 attendance write 2
- PASS school 2 attendance write 3
- PASS school 2 attendance write 4
- PASS school 2 attendance write 5
- PASS school 2 foreign school query empty
- PASS school 2 foreign school attendance write denied
- PASS ten own attendance writes, no foreign writes, before restart
- PASS restart preserves all collection counts including writes
- PASS all required full/overview/reports 1/5/10 baseline measurements completed

## GET /api/etudia/state

| School | Role | Page | Concurrency | Samples | HTTP 200 | p50 ms | p95 ms | Max ms | Max bytes |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | administrator | full | 1 | 1 | 1 | 1760 | 1760 | 1760 | 8847646 |
| 1 | administrator | full | 5 | 5 | 5 | 5047 | 5194 | 5194 | 8847646 |
| 1 | administrator | full | 10 | 10 | 10 | 10014 | 10430 | 10430 | 8847646 |
| 1 | administrator | overview | 1 | 1 | 1 | 17 | 17 | 17 | 57559 |
| 1 | administrator | overview | 5 | 5 | 5 | 36 | 39 | 39 | 57559 |
| 1 | administrator | overview | 10 | 10 | 10 | 56 | 72 | 72 | 57559 |
| 1 | administrator | overview | 50 | 50 | 50 | 308 | 366 | 368 | 57559 |
| 1 | administrator | overview | 100 | 100 | 100 | 821 | 1025 | 1059 | 57559 |
| 1 | administrator | reports | 1 | 1 | 1 | 233 | 233 | 233 | 806120 |
| 1 | administrator | reports | 5 | 5 | 5 | 784 | 823 | 823 | 806120 |
| 1 | administrator | reports | 10 | 10 | 10 | 1396 | 1544 | 1544 | 806120 |
| 1 | administrator | reports | 50 | 50 | 50 | 7565 | 8222 | 8234 | 806120 |
| 1 | student | full | 1 | 1 | 1 | 138 | 138 | 138 | 14274 |
| 1 | student | full | 5 | 5 | 5 | 452 | 498 | 498 | 14284 |
| 1 | student | full | 10 | 10 | 10 | 703 | 871 | 871 | 14284 |
| 1 | student | overview | 1 | 1 | 1 | 14 | 14 | 14 | 4290 |
| 1 | student | overview | 5 | 5 | 5 | 39 | 43 | 43 | 4290 |
| 1 | student | overview | 10 | 10 | 10 | 66 | 83 | 83 | 4290 |
| 1 | student | overview | 50 | 50 | 50 | 327 | 438 | 440 | 4290 |
| 1 | student | overview | 100 | 100 | 100 | 706 | 889 | 904 | 4290 |
| 1 | student | reports | 1 | 1 | 1 | 116 | 116 | 116 | 14002 |
| 1 | student | reports | 5 | 5 | 5 | 348 | 386 | 386 | 14012 |
| 1 | student | reports | 10 | 10 | 10 | 754 | 827 | 827 | 14012 |
| 1 | student | reports | 50 | 50 | 50 | 3827 | 4605 | 4631 | 14012 |
| 1 | student | reports | 100 | 100 | 100 | 8123 | 9396 | 9468 | 14012 |
| 2 | administrator | full | 1 | 1 | 1 | 1701 | 1701 | 1701 | 8847646 |
| 2 | administrator | full | 5 | 5 | 5 | 5099 | 5259 | 5259 | 8847646 |
| 2 | administrator | full | 10 | 10 | 10 | 9764 | 10302 | 10302 | 8847646 |
| 2 | administrator | overview | 1 | 1 | 1 | 16 | 16 | 16 | 57559 |
| 2 | administrator | overview | 5 | 5 | 5 | 35 | 36 | 36 | 57559 |
| 2 | administrator | overview | 10 | 10 | 10 | 55 | 65 | 65 | 57559 |
| 2 | administrator | overview | 50 | 50 | 50 | 307 | 371 | 373 | 57559 |
| 2 | administrator | overview | 100 | 100 | 100 | 778 | 1024 | 1043 | 57559 |
| 2 | administrator | reports | 1 | 1 | 1 | 229 | 229 | 229 | 806120 |
| 2 | administrator | reports | 5 | 5 | 5 | 723 | 758 | 758 | 806120 |
| 2 | administrator | reports | 10 | 10 | 10 | 1315 | 1553 | 1553 | 806120 |
| 2 | administrator | reports | 50 | 50 | 50 | 7629 | 8295 | 8322 | 806120 |
| 2 | student | full | 1 | 1 | 1 | 134 | 134 | 134 | 14274 |
| 2 | student | full | 5 | 5 | 5 | 455 | 496 | 496 | 14284 |
| 2 | student | full | 10 | 10 | 10 | 692 | 852 | 852 | 14284 |
| 2 | student | overview | 1 | 1 | 1 | 14 | 14 | 14 | 4290 |
| 2 | student | overview | 5 | 5 | 5 | 37 | 46 | 46 | 4290 |
| 2 | student | overview | 10 | 10 | 10 | 62 | 81 | 81 | 4290 |
| 2 | student | overview | 50 | 50 | 50 | 413 | 473 | 476 | 4290 |
| 2 | student | overview | 100 | 100 | 100 | 685 | 859 | 882 | 4290 |
| 2 | student | reports | 1 | 1 | 1 | 112 | 112 | 112 | 14002 |
| 2 | student | reports | 5 | 5 | 5 | 402 | 425 | 425 | 14012 |
| 2 | student | reports | 10 | 10 | 10 | 672 | 846 | 846 | 14012 |
| 2 | student | reports | 50 | 50 | 50 | 3951 | 4561 | 4581 | 14012 |
| 2 | student | reports | 100 | 100 | 100 | 7560 | 8727 | 8843 | 14012 |

Reports use the class scope used by the interface (1200 grades for an administrator, 30 own grades for a pupil). Separate scenarios wait out the configured rate-limit window, without disabling rate limits. Full/export is measured at concurrency 1/5/10 only. Overview and reports are measured at 1/5/10 then 50/100 only after healthy previous stages; 1000 is opt-in and not enabled by CI. A resource-budget stop is not evidence of passing the skipped stage.

Student waves reuse a pool of 10 authenticated fictitious pupil accounts (distinct accounts at concurrency 1/5/10). Higher waves measure simultaneous API requests, not that many distinct users. Administrator concurrency reuses one administrator account. No real service receives these requests.

## Load escalation stops
- School 1 administrator reports: stopped escalation after concurrency 50 because of errors, slow extended requests, or resource budget.
- School 1 student reports: stopped escalation after concurrency 100 because of errors, slow extended requests, or resource budget.
- School 2 administrator reports: stopped escalation after concurrency 50 because of errors, slow extended requests, or resource budget.
- School 2 student reports: stopped escalation after concurrency 100 because of errors, slow extended requests, or resource budget.

Latency references: sequential p95 ≤2 s; concurrency 10 p95 ≤5 s. These are indicative, not an SLA. CI runner performance does not establish production capacity. No long-duration or browser rendering benchmark is included.

