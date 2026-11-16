# Étudia — isolated capacity benchmark

Isolated temporary local PocketBase; fictitious data only

Two establishments × 1,600 fictitious pupils; no requests to a public service.

Seed: 14767 ms. SQLite: 30863360 bytes.

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

Disposable-server recovery restarts after a stopped workload: 2

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
- PASS School 1 administrator reports concurrency 100 status/counts/isolation
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
- PASS School 2 administrator reports concurrency 100 status/counts/isolation
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
| 1 | administrator | full | 1 | 1 | 1 | 1121 | 1121 | 1121 | 8847646 |
| 1 | administrator | full | 5 | 5 | 5 | 3269 | 3371 | 3371 | 8847646 |
| 1 | administrator | full | 10 | 10 | 10 | 6519 | 6859 | 6859 | 8847646 |
| 1 | administrator | overview | 1 | 1 | 1 | 11 | 11 | 11 | 57559 |
| 1 | administrator | overview | 5 | 5 | 5 | 18 | 21 | 21 | 57559 |
| 1 | administrator | overview | 10 | 10 | 10 | 37 | 43 | 43 | 57559 |
| 1 | administrator | overview | 50 | 50 | 50 | 171 | 217 | 219 | 57559 |
| 1 | administrator | overview | 100 | 100 | 100 | 520 | 679 | 685 | 57559 |
| 1 | administrator | reports | 1 | 1 | 1 | 96 | 96 | 96 | 806120 |
| 1 | administrator | reports | 5 | 5 | 5 | 275 | 310 | 310 | 806120 |
| 1 | administrator | reports | 10 | 10 | 10 | 531 | 584 | 584 | 806120 |
| 1 | administrator | reports | 50 | 50 | 50 | 2779 | 3031 | 3059 | 806120 |
| 1 | administrator | reports | 100 | 100 | 100 | 5603 | 6145 | 6165 | 806120 |
| 1 | student | full | 1 | 1 | 1 | 25 | 25 | 25 | 14274 |
| 1 | student | full | 5 | 5 | 5 | 52 | 53 | 53 | 14284 |
| 1 | student | full | 10 | 10 | 10 | 94 | 103 | 103 | 14284 |
| 1 | student | overview | 1 | 1 | 1 | 9 | 9 | 9 | 4290 |
| 1 | student | overview | 5 | 5 | 5 | 24 | 27 | 27 | 4290 |
| 1 | student | overview | 10 | 10 | 10 | 44 | 50 | 50 | 4290 |
| 1 | student | overview | 50 | 50 | 50 | 234 | 276 | 278 | 4290 |
| 1 | student | overview | 100 | 100 | 100 | 416 | 559 | 571 | 4290 |
| 1 | student | reports | 1 | 1 | 1 | 16 | 16 | 16 | 14002 |
| 1 | student | reports | 5 | 5 | 5 | 46 | 48 | 48 | 14012 |
| 1 | student | reports | 10 | 10 | 10 | 78 | 80 | 80 | 14012 |
| 1 | student | reports | 50 | 50 | 50 | 508 | 551 | 555 | 14012 |
| 1 | student | reports | 100 | 100 | 100 | 1062 | 1158 | 1165 | 14012 |
| 2 | administrator | full | 1 | 1 | 1 | 1178 | 1178 | 1178 | 8847646 |
| 2 | administrator | full | 5 | 5 | 5 | 3545 | 3631 | 3631 | 8847646 |
| 2 | administrator | full | 10 | 10 | 10 | 7004 | 7233 | 7233 | 8847646 |
| 2 | administrator | overview | 1 | 1 | 1 | 12 | 12 | 12 | 57559 |
| 2 | administrator | overview | 5 | 5 | 5 | 21 | 24 | 24 | 57559 |
| 2 | administrator | overview | 10 | 10 | 10 | 32 | 41 | 41 | 57559 |
| 2 | administrator | overview | 50 | 50 | 50 | 156 | 210 | 211 | 57559 |
| 2 | administrator | overview | 100 | 100 | 100 | 505 | 806 | 816 | 57559 |
| 2 | administrator | reports | 1 | 1 | 1 | 88 | 88 | 88 | 806120 |
| 2 | administrator | reports | 5 | 5 | 5 | 318 | 348 | 348 | 806120 |
| 2 | administrator | reports | 10 | 10 | 10 | 572 | 641 | 641 | 806120 |
| 2 | administrator | reports | 50 | 50 | 50 | 2917 | 3121 | 3130 | 806120 |
| 2 | administrator | reports | 100 | 100 | 100 | 5892 | 6301 | 6318 | 806120 |
| 2 | student | full | 1 | 1 | 1 | 25 | 25 | 25 | 14274 |
| 2 | student | full | 5 | 5 | 5 | 57 | 58 | 58 | 14284 |
| 2 | student | full | 10 | 10 | 10 | 100 | 104 | 104 | 14284 |
| 2 | student | overview | 1 | 1 | 1 | 13 | 13 | 13 | 4290 |
| 2 | student | overview | 5 | 5 | 5 | 39 | 43 | 43 | 4290 |
| 2 | student | overview | 10 | 10 | 10 | 44 | 51 | 51 | 4290 |
| 2 | student | overview | 50 | 50 | 50 | 247 | 289 | 290 | 4290 |
| 2 | student | overview | 100 | 100 | 100 | 460 | 579 | 593 | 4290 |
| 2 | student | reports | 1 | 1 | 1 | 14 | 14 | 14 | 14002 |
| 2 | student | reports | 5 | 5 | 5 | 44 | 45 | 45 | 14012 |
| 2 | student | reports | 10 | 10 | 10 | 70 | 76 | 76 | 14012 |
| 2 | student | reports | 50 | 50 | 50 | 482 | 522 | 523 | 14012 |
| 2 | student | reports | 100 | 100 | 100 | 1003 | 1081 | 1084 | 14012 |

Reports use the class scope used by the interface (1200 grades for an administrator, 30 own grades for a pupil). Separate scenarios wait out the configured rate-limit window, without disabling rate limits. Full/export is measured at concurrency 1/5/10 only. Overview and reports are measured at 1/5/10 then 50/100 only after healthy previous stages; 1000 is opt-in and not enabled by CI. A resource-budget stop is not evidence of passing the skipped stage.

Student waves reuse a pool of 10 authenticated fictitious pupil accounts (distinct accounts at concurrency 1/5/10). Higher waves measure simultaneous API requests, not that many distinct users. Administrator concurrency reuses one administrator account. No real service receives these requests.

## Load escalation stops
- School 1 administrator reports: stopped escalation after concurrency 100 because of errors, slow extended requests, or resource budget.
- School 2 administrator reports: stopped escalation after concurrency 100 because of errors, slow extended requests, or resource budget.

Latency references: sequential p95 ≤2 s; concurrency 10 p95 ≤5 s. These are indicative, not an SLA. CI runner performance does not establish production capacity. No long-duration or browser rendering benchmark is included.

