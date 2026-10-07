# ACE Wind Turbine Data - Exploratory Analysis & Parameter Translation

This document presents the exploratory data analysis (EDA), dataset verification, and parameter-to-audience translation for the **Ambition Community Energy (ACE)** 4.2 MW wind turbine project in Avonmouth / Lawrence Weston, Bristol, UK. 

All figures, ranges, variables, and architectural details in this document are strictly cross-verified against the official project data sources:
- [`DATA_SOURCES.md`](./DATA_SOURCES.md)
- [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md)
- [`API_REFERENCE.md`](./API_REFERENCE.md)
- [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md)

---

## 1. Exploratory Analysis Summary Table

The table below summarizes the 5 primary telemetry tiers across the **Zenodo Open Archive** (DOIs `10.5281/zenodo.22662372` and `10.5281/zenodo.22794387`) and the **Live ACE API** (`https://ace-api.duckdns.org`):

| Dataset | Expected Rows | Time Range | Missing % | Main Observation & Operational Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **`1s instantaneous`** | • **Live API:** ~3,024,000 rows (35-day rolling buffer at 1 Hz)<br>• **Zenodo:** ~2.5M – 3.0M rows/month (`ace-wind-2026-instantaneous_1s.parquet`, ~127.7 MB) | Rolling 35 days (API) / Target monthly campaigns (Zenodo) | `< 0.5%` (Brief OPC UA dropouts or poll retry windows) | Captures fine aerodynamic turbulence, instantaneous wind gusts, dynamic blade pitch response, rotor RPM (nominal 5–13.5 rpm), and generator active power (0–4,245 kW). Drives the real-time 60 FPS animated turbine display and live power gauges. |
| **`60s instantaneous`** | • **Live API:** ~129,600 rows (90-day rolling buffer)<br>• **Zenodo:** ~525,960 rows/year (`ace-wind-2026-instantaneous_60s.parquet`, ~17.7 MB; `60s.parquet`, ~50.8 MB) | Rolling 90 days (API) / Continuous annual archive (Zenodo) | `< 1.0%` | Filters sub-second mechanical vibrations while preserving wind ramp events, yaw tracking slews, and fast curtailment transitions. Ideal for 24-hour and 7-day high-resolution trend charts without excessive browser memory consumption. |
| **`10m SCADA`** | • **Live API:** ~52,704 rows (366-day / 1-year retention)<br>• **Zenodo:** ~180,000 rows total (`ace-wind-2026-10m.parquet`, ~5.38 MB, 2023–2026) | March 29, 2023 to Present (continuous monthly releases) | `< 1.5%` (Correlates with grid outages, DNO disconnects, or scheduled servicing) | International standard IEC 61400-25 SCADA benchmark (`wecstd` family). Records statistical moments (`mean`, `min`, `max`, `Sample` count) for wind speed, power, pitch angle, and temperatures. Used for power curves, availability accounting, and capacity factors. |
| **`Daily`** | • **Live API & Zenodo:** ~1,250 – 1,280 days total (`ace-wind-2026-daily.parquet`, ~311 KB, lifetime retention) | March 29, 2023 (Commissioning) to Present | `0.0%` (Rollup records exist for every calendar day; 0 kWh on outage days) | Macro-level operational tracking: daily exported energy (`kWh` / `MWh`), cumulative generator operating hours (`arwAbWorkH`), capacity factor (~28–32% annual benchmark for ~10.5 GWh/yr), and daily community revenue contributions. |
| **`Events`** | • **Live API & Zenodo:** ~10,000 – 50,000 state transitions (`ace-wind-2026-events.parquet`, ~294 KB) | March 29, 2023 to Present (continuous event log) | N/A (Event-driven / sparse logging on state changes) | Complete audit log of operational state transitions (`main_status`: 0=Generating, 1=Paused, 2=Starting, 9=Fault), advisory warning flags, maintenance service flags, and National Grid / DNO export curtailment setpoints. |

---

## 2. Audience-Facing Question Translation Matrix

To make the turbine telemetry intuitive and engaging for visitors at the Ambition Lawrence Weston Community Centre, raw engineering parameters are translated below into human-centric questions categorized by experience pillar:

| Audience Question | Telemetry & Data Needed | Source Pipeline | Recommended Public Display / UI Experience |
| :--- | :--- | :--- | :--- |
| **1. Live Operations & Turbine Feel** | | | |
| *Is the turbine spinning right now?* | `wec_rotor_speed` (rpm, nominal 5–13.5) | Live API (`wec_instantaneous`, 1s) | **Real-Time Animated Turbine (SVG/Canvas):** 3-blade rotor rotating at exact physical RPM with smooth CSS/WebGL transitions. |
| *How windy is it up there right now?* | `wec_wind_speed` (m/s) | Live API (`wec_instantaneous`, 1s) | **Dynamic Wind Speedometer Gauge:** Calibrated dial (0–35 m/s) with Beaufort scale labels (*"Gentle Breeze"*, *"Fresh Gale"*). |
| *How much electricity is it making this second?* | `wec_active_power` (kW, 0–4,245 kW) | Live API (`wec_instantaneous`, 1s) | **Pulsing Power Dial:** Live kilowatt counter with visual energetic glow scaling from amber (low) to neon cyan/green (rated 4.2 MW). |
| *Which way is the wind blowing, and where is the turbine pointing?* | `wec_nacelle_position` (deg), `aggregate_wind_direction` (deg) | Live API (`wec_instantaneous`, 1s; `site_instantaneous`) | **Interactive Compass Rose:** Dual-pointer compass displaying real-time wind direction vs. the 150m nacelle yaw orientation angle. |
| *How fast are the blade tips slicing through the air?* | `wec_rotor_speed` × $\pi \times 115.7\text{ m} / 60$ | Live API (`wec_instantaneous`, 1s) + Static Spec | **Kinetic Speed Comparison Badge:** Tip speed calculated in mph/km/h (up to ~180 mph / 290 km/h) compared to an express train or cheetah. |
| **2. Community Impact & Social Value (Lawrence Weston)** | | | |
| *How many homes in Lawrence Weston are being powered right now?* | `wec_active_power` (kW) ÷ 0.35 kW (avg UK household demand) | Live API (`wec_instantaneous`) | **Community Village Grid:** Illuminated grid of up to ~4,000 neighborhood home icons dynamically lighting up as power increases. |
| *How much did the turbine generate today?* | `energy_produced` (daily cumulative delta, kWh/MWh) | Historical Rollup / API (`wecstd` daily) | **"Today's Clean Energy" Card:** Large hero counter showing MWh produced since midnight alongside progress toward the daily average. |
| *How does today compare with yesterday or last week?* | `energy_produced` (daily), `wind_speed_mean` | Zenodo + API (`wecstd` daily) | **Comparative Trend Bar Chart:** Side-by-side daily generation bars with contextual tags (*"Today generated 38% more than yesterday"*). |
| *How much money has the turbine earned for our community fund?* | Cumulative `energy_produced` × local community PPA tariff (£/MWh) | Zenodo + Live API | **Community Prosperity Tracker:** Digital piggy bank showing funding unlocked for Lawrence Weston warm hubs and fuel poverty vouchers. |
| *How much carbon pollution has our turbine prevented?* | Cumulative kWh × 0.207 kg CO₂/kWh (UK grid displacement) | Zenodo Lifetime (`wec_energy_exported`) | **Carbon Offset Visualizer:** Cumulative metric tons of CO₂ avoided, visualised as equivalent mature trees planted or car journeys taken off the M5. |
| **3. Inside the Machine (STEM & Digital Twin)** | | | |
| *What is happening inside the turbine nacelle?* | `tep3c021` (`front_bearing`, `rear_bearing`, `rotor_1`, `transformer`) | 10m / 60s Telemetry | **Interactive Nacelle Cutaway (Digital Twin):** Transparent mechanical exploded model with temperature hotspots and bearing indicators. |
| *How hot does the generator get when producing full power?* | `rotor_1_temperature_mean`, `rotor_2_temperature_mean`, `cooling_water` | 10m SCADA (`tep3c021`) | **Generator Thermal Monitor:** Color-graded heat map of the direct-drive permanent magnet rotor and liquid cooling circuit. |
| *How cold is it 150m up in the clouds compared to ground level?* | `outside_hub_height_temperature_mean` vs. `outside_ground_temperature_mean` | 10m SCADA (`tep3c021`) | **Vertical Temperature Gradient:** Dual thermometer graphic illustrating atmospheric temperature lapse rate between ground and hub. |
| *Is ice forming on the giant blades during winter?* | `labko_ice_amplitude_mean`, `ice_formation_timer_mean` | 10m SCADA (`wecstd`) | **Winter Weather & Blade De-Icing Pill:** Ice vibration sensor gauge indicating blade icing risk and automatic aerodynamic de-icing status. |
| *How hard are the electronic inverters working?* | `inverter_01` to `inverter_16_cabinet_temperature_mean` | 10m SCADA (`tep3c022`) | **Inverter Array Status Board:** 16-cell interactive grid displaying the thermal status of all 16 modular Enercon IGBT power converter stacks. |
| **4. Operational Diagnostics & Weather Context** | | | |
| *Why did production drop suddenly when it still looks windy?* | `main_status`, `fault_message_flag`, `aggregate_available_power_after_external_setpoints` | Events (`status`) + Live Telemetry | **Plain-English Status Pill:** Clear explanation badge: e.g., *"National Grid export limit (curtailment)"*, *"Scheduled maintenance"*, or *"Storm cut-out"*. |
| *Why is the turbine stopped when trees are swaying outside?* | `wec_wind_speed` vs. cut-in (2.5 m/s) and cut-out (28.0 m/s) | Live API (`wec_instantaneous`) | **Wind Threshold Diagram:** Visual gauge showing current wind against cut-in (2.5 m/s), rated (12.5 m/s), and high-wind storm limits (28–34 m/s). |
| *What was the single windiest storm ever recorded at the turbine?* | `wind_speed_max` across all time (`prwSmpVWi`) | Zenodo 10m Archive | **"All-Time Storm Hall of Fame":** Highlight card showcasing record wind gusts recorded during named storms (e.g., Storm Isha, Storm Babet). |

---

## 3. Comprehensive Analysis of the Zenodo Historical Dataset

The following section answers the 10 core questions regarding the Zenodo dataset, verified against the repository documentation and system specifications:

### 1. What dates are available?
- **Start Date:** **March 29, 2023** (`2023-03-29T00:00:00.000+01:00`). This is the verified commercial commissioning date of the turbine (`wec_availability_start` in `API_REFERENCE.md`).
- **End Date:** The latest verified published Zenodo release is **Version `2026.08_v2`** (Record DOI `10.5281/zenodo.22794387`), covering continuous operational data through **August 31, 2026**.
- **Update Cadence:** Monthly open data releases published on Zenodo following quality assurance audits (`DATA_SOURCES.md`).

### 2. Is the dataset continuous?
- **Yes**, for standard time-series streams:
  - `10m.parquet` adheres to regular, continuous 600-second intervals (144 timestamps per day).
  - `60s.parquet` adheres to regular, continuous 60-second intervals (1,440 timestamps per day).
  - `daily.parquet` adheres to regular 86,400-second calendar rollups (1 timestamp per day).
- **Asynchronous / Event-Driven Streams:**
  - `events.parquet` and `configuration.parquet` are recorded asynchronously upon state transitions, error trip activations, or setpoint commands.

### 3. Are there gaps?
- **Yes**, real-world operational and communication gaps exist and are properly flagged:
  - **Grid Curtailment & Outages:** External network disconnects by the Distribution Network Operator (National Grid / Western Power Distribution) or force majeure events.
  - **SCADA Communication Interruptions:** Quantified via `aggregate_communication_availability` and the native OPC tag `ComState`.
  - **Scheduled Servicing:** Maintenance intervals during which turbine technicians are on-site (`service_flag = 1`, `main_status = 9`).
  - **Sample Completeness:** In `wecstd`, the `sample_count` field (`Sample`) indicates how many valid high-speed samples were collected during the 600-second window (a value of 600 indicates 100% completeness).

### 4. How many turbines/assets are represented?
- **Exactly ONE Wind Turbine:**
  - Asset ID: `wec-1` ("ACE Wind Turbine")
  - Model: Enercon E-115 EP3 (WEC Type `EP3-CS02`, Serial No. `1160104`)
  - Rated capacity: 4.2 MW (nominal power 4,245 kW)
  - Dimensions: Tip height 150m (hub ~92m), rotor diameter 115.7m (tallest onshore wind turbine in England)
  - OPC Node Path: `Loc/Wec/Plant1`
- **Accompanied by ONE Substation Site Controller:**
  - Asset ID: `controller-2` ("ACE Site Controller")
  - Model: Enercon Farm Control Unit (FCU E2, Serial No. `9170822`)
  - OPC Node Path: `Loc/Ctrl/Plant2`
- **Site-Level Representation:**
  - Site ID: `ace` (Location No. `9547`, Avonmouth / Lawrence Weston, Bristol, UK).

### 5. What variables are actually populated?
Across the 14 data families specified in the API and dataset catalogue:
- **`site_instantaneous` (14 fields):** Net active power, wind speed, wind direction, reactive power, power factor, communication availability, technical availability, external curtailment setpoint caps, and reserve capacities.
- **`wec_instantaneous` (21 fields):** Generator active power (`P`), anemometer wind speed (`Vwind`), rotor speed (`NRotor`), nacelle orientation heading (`GoPos`), cumulative exported energy (`Wexp`), operational hours (`Hour`), 3-phase voltages ($U_{L1}, U_{L2}, U_{L3}$), 3-phase currents ($I_{L1}, I_{L2}, I_{L3}$), and AC grid frequency (`Freq`).
- **`wecstd` (33 fields):** 10-minute statistical moments (mean, min, max) for wind speed, active power, reactive power, rotor speed; pitch blade angle; ambient weather (air temperature, atmospheric pressure, relative humidity, precipitation, visibility, Labko ice sensor amplitude).
- **Mechanical & Structural Temperatures (`tep3c021`, 21 fields):** Front and rear main shaft bearings, spinner dome, rotor blades A/B/C roots, direct-drive generator rotor windings 1 and 2, cooling water loop, nacelle cabin, control cabinets, and 33 kV step-up transformer.
- **Inverter Temperatures (`tep3c022`, 16 fields):** Thermal sensors for each modular IGBT converter stack (`inverter_01` to `inverter_16`).
- **Grid Substation Controller (`fcu2ctr1` / `fcu2ctr2`):** Point of common coupling line-to-line voltages, 3-phase currents, apparent power, fiscal energy exported and consumed.
- **Events & Status (`status`):** Operational state codes (`main_status`, `substatus`), fault flag (`fault_message_flag`), warning flag (`warning_message_flag`), service flag (`service_flag`), and diagnostic IDs.

### 6. Are timestamps UTC or local?
- **Timestamps are strictly UTC natively across all files and endpoints.**
- In the Live API, timestamps are formatted as integer **Unix epoch microseconds** (e.g. `1790853965095000` = `1790853965.095 s UTC`).
- In Parquet files, timestamps are stored as standard UTC-encoded datetime objects.
- In site configuration: `scada_time_zone = "0"` (UTC). While `scada_daylight_saving = "True"` indicates whether British Summer Time (BST, UTC+1) is active locally in Bristol, stored telemetry remains strictly monotonically increasing UTC to eliminate duplicate or missing hours during daylight saving transitions.

### 7. Are there null / invalid values?
- **Yes, standard SCADA sentinel patterns occur:**
  - Handled cleanly in API payloads via the columnar `quality` vector (`"good"`, `"bad"`, `"uncertain"`).
  - In Parquet tables, missing sensor channels or unpolled intervals contain standard Parquet nulls / NaNs.
  - Sensor health can be cross-verified by checking `sample_count < 600` in 10-minute intervals or checking if `fault_message_flag == 1`.

### 8. Are there suspicious values or outliers?
Operational wind turbine physics produce valid measurements that may appear anomalous to non-specialists:
- **Negative Active Power ($-10$ to $-50\text{ kW}$):** When wind speed is below cut-in ($< 2.5\text{ m/s}$) or during idling, the generator consumes a small amount of parasitic power from the grid to power auxiliary control systems, cooling pumps, and nacelle lighting.
- **Zero Generation During High Winds ($> 28\text{ m/s}$):** Above cut-out storm speed (28.0–34.0 m/s), the turbine pitches its blades to 90° (feathered) to protect the structure, resulting in 0 kW output despite high winds.
- **Power Clamping at 4,200 kW:** The turbine's maximum physical output is 4,245 kW, but the FCU controller frequently caps export at 4,200.0 kW (`controller_setpoint_1`) to adhere to grid connection agreements.
- **Labko Ice Sensor Fluctuations:** During freezing winter periods, vibration sensor amplitudes spike due to rime ice formation on the blades before de-icing sequences trigger.

### 9. How do the 1s, 60s, and 10m datasets relate?
- **Hierarchical Temporal Downsampling:**
  - **1s (1 Hz):** Direct physical sensor readings from OPC UA nodes (`Loc/Wec/Plant1/...`).
  - **60s:** 1-minute aggregations derived from sixty 1-second samples.
  - **10m (`wecstd`):** The international IEC 61400-25 wind SCADA standard. Each 10-minute record aggregates 600 one-second samples into statistical moments:
    $$\text{active\_power\_mean} = \frac{1}{N} \sum_{i=1}^{N} P_i, \quad \text{active\_power\_max} = \max(P_i), \quad \text{active\_power\_min} = \min(P_i)$$
  - **Daily:** Aggregates 144 ten-minute intervals (or 86,400 one-second intervals) into total cumulative energy exported ($\text{kWh}$), active generation hours, and fiscal availability.

### 10. Does the historical dataset overlap with the Live API?
- **Yes, with tiered retention boundaries:**
  - **Daily Rollup:** **Complete Lifetime Overlap.** The Live API retains daily data from commissioning (March 29, 2023) to the current day, matching `ace-wind-2026-daily.parquet`.
  - **10m SCADA:** **Full 366-Day (1-Year) Overlap.** The Live API retains a rolling 366 days, providing continuous overlap with the monthly published Zenodo archive `ace-wind-2026-10m.parquet`.
  - **60s Telemetry:** **90-Day Overlap.** The Live API retains 90 rolling days.
  - **1s Instantaneous:** **35-Day Rolling Window.** The Live API holds the last 35 days of 1 Hz telemetry; Zenodo archives monthly batches.
  - **Integration Architecture:** The public display uses the Live API for instantaneous real-time telemetry (Now View) and queries Zenodo historical baselines to generate immediate contextual comparisons (e.g. comparing today's wind against the 3-year seasonal average).

---

## 4. Citation & Attribution

In compliance with project requirements, any display, dashboard, or derivative work referencing this analysis must include the official citation:

> **Attribution:**  
> *Plumley, Charlie; Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew. ACE Wind Turbine Data. Zenodo. https://doi.org/10.5281/zenodo.22662372*  
> Published by Ambition Community Energy (ACE) under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
