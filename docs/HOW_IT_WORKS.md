# How Weston Wind works

Checked on **14 October 2026**. The new history system is running on Contabo.
Historical screens, chatbot lookups, Grafana and CSV now read the same table.

## The server and the screens

The server collects and checks turbine readings, then sends them to the website.
The screens show power, wind, turbine movement and homes powered.
They request older readings for daily bars and the power curve. Ask Ace uses the server too.

## Where the numbers come from today

| What you see | Where the server gets it |
|---|---|
| Current power, wind, rotor speed, direction and status | The ACE API. Power and wind are checked about every second. Status is checked every five seconds. |
| Today's energy summary | The new TimescaleDB table. Estimated from ten-minute average power. |
| Daily bars and weekly totals | The new table, grouped using UK dates. |
| Measured power curve and historical records | The new table. Records cover the stored period, not the turbine's whole lifetime. |
| Historical comparisons and chatbot history questions | The same new table. |
| Past wind and power requested through `/api/history` | The new table through the server. |

Live readings stay in memory. They are **not saved every second**.
Older readings are collected from ACE history; Zenodo fills any missing times.
Zenodo publishes history **monthly**. Its original downloads still work.

## How far back can we go?

The stored ten-minute readings run from **21 July 2026 at 10:40 UTC** to
**14 October 2026 at 04:10 UTC**: about **85 days**, with no gaps at this check.
New readings extend this range.
The advertised limit is 366 days, but that much ten-minute history is not available today.

The local Zenodo ten-minute file runs from **21 July to 30 September 2026**.
We do not have six months of ten-minute readings yet.

## How history now works

```text
LIVE NOW:     ACE API -> server memory -> live screens

HISTORY:
              ACE ten-minute history ----+
                                        +-> one history database -> historical screens,
              supplied Zenodo files ----+
                                                               Ask Ace, Grafana and CSV
```

The new database saves ten-minute readings. ACE wins when both sources have the same time.
Zenodo fills missing times. Your supplied file had 10,304 readings; all matched ACE, so it added no rows.
ACE is checked every ten minutes. The daily release check skips files already imported.
Downloading a future new Zenodo release still needs a successful server download check.
All history views read this database. Today's and daily energy are labelled as estimates.
Live readings and animation stay live. Story chapters, cameras and 3D models are unchanged.

Today's small fixes merged duplicate database times, corrected UK clock handling,
and made old or bad live readings clearer.

## Is it working? Do I need to do anything?

The website, collector and Grafana are running on Contabo. Nightly backups are enabled.
A server backup was restored into a separate database, and a copy was saved on your laptop.
The screens and historical chatbot answers switched on 14 October after comparison and database tests.
The old stores are kept for recovery. Automatic backup copies outside Contabo and protected SSH login still need setup.
See [CONTABO_DEPLOYMENT.md](CONTABO_DEPLOYMENT.md) for links and remaining work.
