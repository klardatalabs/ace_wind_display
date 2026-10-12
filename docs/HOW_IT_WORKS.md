# How Weston Wind works

Checked on **12 October 2026**. The new history system is built and tested, but **not switched on yet**.

## The server and the screens

The server collects and checks turbine readings, then sends them to the website.
The screens show power, wind, turbine movement and homes powered.
They request older readings for daily bars and the power curve. Ask Ace uses the server too.

## Where the numbers come from today

| What you see | Where the server gets it |
|---|---|
| Current power, wind, rotor speed, direction and status | The ACE API. Power and wind are checked about every second. Status is checked every five seconds. |
| Today's energy summary | The ACE API, checked every minute. |
| Daily bars and weekly totals | The existing SQLite database, a local file containing older readings. |
| Measured power curve and historical records | The existing TimescaleDB database. Without it, the curve can show the maker's reference line only. |
| Historical comparisons | TimescaleDB when available; otherwise SQLite. |
| Past wind and power requested through `/api/history` | Directly from the ACE API through the server. |

Live readings stay in memory. They are **not saved every second**.
Older database readings come from ACE history and imported Zenodo files.
Zenodo publishes history **monthly**. Its original downloads still work.

## How far back can we go?

The API check found ten-minute readings from **21 July 2026 at 10:40 UTC** to
**12 October 2026 at 08:20 UTC**: about **83 days**.
This is the reported range; it may contain missing readings. New readings extend it.
The advertised limit is 366 days, but that much ten-minute history is not available today.

The local Zenodo ten-minute file runs from **21 July to 30 September 2026**.
We do not have six months of ten-minute readings yet.

## What today's history work prepares

```text
LIVE NOW:     ACE API -> server memory -> live screens

HISTORY, AFTER THE SWITCH:
              ACE ten-minute history ----+
                                        +-> one history database -> graphs, Ask Ace,
              monthly Zenodo files -----+                          CSV and Grafana
```

The new database will save ten-minute readings. ACE wins when both sources have the same time.
Zenodo fills missing times. ACE will be checked every ten minutes; new Zenodo releases, daily.
All history views will read this database. Daily energy will be labelled as an estimate.
Live readings and animation stay live. Story chapters, cameras and 3D models are unchanged.

Today's small fixes merged duplicate database times, corrected UK clock handling,
and made old or bad live readings clearer.

## Is it working? Do I need to do anything?

The existing paths remain selected. The new path passed local tests, including backup and recovery.
**The real new database, Grafana and combined CSV downloads still need setup and activation.**
No switch is needed for the current screens. Activation is planned after the **28 October presentation**.
You or your server operator must set passwords, choose an off-laptop backup location,
fill and check the new database, then turn it on. Follow [HISTORY_RUNBOOK.md](HISTORY_RUNBOOK.md).
