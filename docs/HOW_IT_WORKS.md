# How Weston Wind works

Checked on **12 October 2026**. The new history database is collecting on Contabo.
The screens and chatbot still use their existing history connections during testing.

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

NEW HISTORY DATABASE, COLLECTING NOW:
              ACE ten-minute history ----+
                                        +-> one history database -> Grafana and CSV
              supplied Zenodo files ----+
                                         Screens and Ask Ace switch after checks.
```

The new database saves ten-minute readings. ACE wins when both sources have the same time.
Zenodo fills missing times. Your supplied file had 10,304 readings; all matched ACE, so it added no rows.
ACE is checked every ten minutes. Future automatic Zenodo imports are currently blocked by Zenodo refusing the server's requests.
After the switch, all history views will read this database. Daily energy will be labelled as an estimate.
Live readings and animation stay live. Story chapters, cameras and 3D models are unchanged.

Today's small fixes merged duplicate database times, corrected UK clock handling,
and made old or bad live readings clearer.

## Is it working? Do I need to do anything?

The website, collector and Grafana are running on Contabo. Nightly backups are enabled.
A server backup was restored into a separate database, and a copy was saved on your laptop.
The screens and historical chatbot answers have not switched to the new table yet.
Review the hosted screens and charts first. See [CONTABO_DEPLOYMENT.md](CONTABO_DEPLOYMENT.md) for links and remaining work.
