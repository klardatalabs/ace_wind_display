# ACE Wind Turbine Data - Data Dictionary

This document provides a comprehensive catalog of all telemetry variables, engineering units, source sampling rates, and physical descriptions across the **ACE Live API** and **Zenodo Historical Datasets**.

---

## 1. Primary Live Display Signals (Instantaneous)

These are the primary high-frequency signals used for real-time animated dashboards, gauges, and digital twins.

### 1.1 `site_instantaneous` (Site Aggregate Signals)
- **Scope:** Site-level (`site_id = "ace"`)
- **Resolutions:** `1s` (1 Hz real-time), `60s` (1-minute aggregates)
- **Primary Source:** Direct OPC UA aggregation node `Loc/Wec/...`

| Field Name | Unit | Native OPC Tag | Description & Display Use |
| :--- | :--- | :--- | :--- |
| `aggregate_active_power` | kW | `Loc/Wec/CalcP` | **Total net active electrical power** exported to the grid. Key gauge metric. |
| `aggregate_wind_speed` | m/s | `Loc/Wec/CalcVwind` | Current site-level wind speed. |
| `aggregate_wind_direction` | deg | `Loc/Wec/CalcWDir` | Compass wind direction (0° = North, 90° = East, 180° = South, 270° = West). |
| `aggregate_reactive_power` | kvar | `Loc/Wec/CalcQ` | Net reactive power flow (inductive/capacitive). |
| `aggregate_power_factor` | — | `Loc/Wec/CalcCosPhi` | Site electrical power factor (cos φ, nominal ~1.00). |
| `aggregate_available_wecs` | % | `Loc/Wec/AvaPlant` | Turbine operational availability percentage. |
| `aggregate_communication_availability`| % | `Loc/Wec/ComState` | SCADA communication link health status. |
| `aggregate_theoretical_maximum_active_power` | kW | `Loc/Wec/AbstMaxP` | Maximum unconstrained power production possible under prevailing wind conditions. |
| `aggregate_available_power_by_wind` | kW | `Loc/Wec/PavaVWind` | Potential power extractable from available wind speed. |
| `aggregate_technically_available_power` | kW | `Loc/Wec/PavaTech` | Power available accounting for turbine technical status. |
| `aggregate_available_power_after_force_majeure` | kW | `Loc/Wec/PavaForceM` | Power available after grid or external outage restrictions. |
| `aggregate_available_power_after_external_setpoints` | kW | `Loc/Wec/PavaExtern` | Power cap applied by National Grid or DNO curtailment orders. |
| `aggregate_reactive_power_absorption_reserve` | kvar | `Loc/Wec/CalcQAbsRes`| Grid support reserve capacity for absorbing reactive power. |
| `aggregate_reactive_power_generation_reserve` | kvar | `Loc/Wec/CalcQGenRes`| Grid support reserve capacity for generating reactive power. |

---

### 1.2 `wec_instantaneous` (Turbine Nacelle & Rotor Signals)
- **Scope:** Asset-level (`asset_id = "wec-1"`)
- **Resolutions:** `1s` (1 Hz real-time), `60s` (1-minute aggregates)
- **Primary Source:** Direct OPC UA node `Loc/Wec/Plant1/...`

| Field Name | Unit | Native OPC Tag | Description & Display Use |
| :--- | :--- | :--- | :--- |
| `wec_active_power` | kW | `{asset_path}/P` | Real-time generator power output. (0 to 4,245 kW). |
| `wec_wind_speed` | m/s | `{asset_path}/Vwind` | Wind speed measured by nacelle anemometer. |
| `wec_rotor_speed` | rpm | `{asset_path}/NRotor` | **Rotor rotational speed** (revolutions per minute). Drives the live animated turbine SVG/3D. (Nominal 5 to 13.5 rpm). |
| `wec_wind_direction` | deg | `{asset_path}/Vane` | Local wind vane angle relative to nacelle heading. |
| `wec_nacelle_position` | deg | `{asset_path}/GoPos` | Absolute azimuth orientation of the nacelle (yaw heading, 0–360°). |
| `wec_energy_exported` | kWh | `{asset_path}/Wexp` | Cumulative lifetime energy exported by the turbine. Used for lifetime impact stats. |
| `wec_operating_hours` | h | `{asset_path}/Hour` | Total cumulative generator operational hours. |
| `wec_power_factor` | — | `{asset_path}/CosPhi` | Turbine generator power factor. |
| `wec_reactive_power` | kvar | `{asset_path}/Q` | Generator reactive power. |
| `wec_voltage_l1` | V | `{asset_path}/U-L1` | Phase 1 generator output terminal voltage. |
| `wec_voltage_l2` | V | `{asset_path}/U-L2` | Phase 2 generator output terminal voltage. |
| `wec_voltage_l3` | V | `{asset_path}/U-L3` | Phase 3 generator output terminal voltage. |
| `wec_current_l1` | A | `{asset_path}/I-L1` | Phase 1 generator output current. |
| `wec_current_l2` | A | `{asset_path}/I-L2` | Phase 2 generator output current. |
| `wec_current_l3` | A | `{asset_path}/I-L3` | Phase 3 generator output current. |
| `wec_frequency` | Hz | `{asset_path}/Freq` | Generated AC grid frequency (nominal 50.0 Hz in UK). |
| `wec_available_power_by_wind` | kW | `{asset_path}/PavaVWind` | Available wind power at rotor disc. |
| `wec_technically_available_power` | kW | `{asset_path}/PavaTech` | Technically available generator capacity. |
| `wec_available_power_after_force_majeure` | kW | `{asset_path}/PavaForceM` | Available power post-outages. |
| `wec_available_power_after_external_setpoints`| kW | `{asset_path}/PavaExtern` | Available power post-curtailment. |

---

## 2. Standard 10-Minute & Hourly SCADA Signals (`wecstd`)

The `wecstd` family follows the international IEC 61400-25 standard for wind turbine SCADA logging. It provides statistical moments (mean, min, max) over 10-minute and 60-second intervals.

- **Scope:** Asset-level (`wec-1`)
- **Resolutions:** `60s`, `10m`, `daily`
- **Fields (33):**

| Field Name | Unit | Native Enercon Tag | Description |
| :--- | :--- | :--- | :--- |
| `sample_count` | count | `Sample` | Number of high-speed samples in averaging window. |
| `wind_speed_mean` | m/s | `mrwSmpVWi` | 10-minute mean horizontal wind speed. |
| `wind_speed_max` | m/s | `prwSmpVWi` | 10-minute maximum wind gust. |
| `wind_speed_min` | m/s | `lrwSmpVWi` | 10-minute minimum wind speed. |
| `rotor_speed_mean` | rpm | `mrwSmpNRot` | 10-minute mean rotor rotational speed. |
| `rotor_speed_max` | rpm | `prwSmpNRot` | 10-minute peak rotor speed. |
| `rotor_speed_min` | rpm | `lrwSmpNRot` | 10-minute minimum rotor speed. |
| `active_power_mean` | kW | `mrwSmpP` | 10-minute mean active power output. |
| `active_power_max` | kW | `prwSmpP` | 10-minute peak electrical power output. |
| `active_power_min` | kW | `lrwSmpP` | 10-minute minimum electrical power output. |
| `nacelle_position` | deg | `mrwAbGoPos` | Mean nacelle orientation during log window. |
| `operating_hours` | h | `arwAbWorkH` | Cumulative operating hours at period end. |
| `energy_produced` | kWh | `arwAbW` | Cumulative cumulative energy meter value (kWh). |
| `production_time` | min | `arwAbWrkM` | Cumulative active generation minutes. |
| `reactive_power_mean` | kvar | `mrwSmpQ` | Mean reactive power. |
| `reactive_power_max` | kvar | `prwSmpQ` | Maximum reactive power. |
| `reactive_power_min` | kvar | `lrwSmpQ` | Minimum reactive power. |
| `blade_angle_mean` | deg | `mrwSmpAng` | Mean rotor blade pitch angle (aerodynamic control). |
| `available_power_by_wind_mean` | kW | `mrwSmpPwin` | Mean wind-available power. |
| `technically_available_power_mean` | kW | `mrwSmpPte` | Mean technical available power. |
| `available_power_after_force_majeure_mean` | kW | `mrwSmpPfm` | Mean power post force majeure. |
| `available_power_after_external_setpoints_mean` | kW | `mrwSmpPext` | Mean power post DNO curtailment. |
| `air_temperature_mean` / `outside_hub_height` | °C | `mrEP3A31` | Ambient air temperature at 150m hub height. |
| `air_pressure_mean` | mbar | `mrwSmpAirP` | Atmospheric air pressure. |
| `air_humidity_mean` | % | `mrwSmpAirH` | Relative atmospheric humidity. |
| `ambient_brightness_mean` | lux | `mrwSmpBriN` | Ambient daylight brightness level. |
| `precipitation_mean` | mm/min | `mrwSmpRai` | Mean precipitation rate. |
| `precipitation_max` | mm/min | `prwSmpRai` | Peak rainfall rate during interval. |
| `precipitation_min` | mm/min | `lrwSmpRai` | Minimum rainfall rate. |
| `visibility_mean` | km | `mrwSmpVisR` | Atmospheric visibility distance. |
| `visibility_max` | km | `prwSmpVisR` | Maximum visibility. |
| `visibility_min` | km | `lrwSmpVisR` | Minimum visibility. |
| `labko_ice_amplitude_mean` | % | `mrwSmpLIcA` | Labko ice detection sensor vibration amplitude. |
| `ice_formation_timer_mean` | °C min | `mrwSmpCIce` | Ice formation cumulative condition timer. |

---

## 3. Subsystem Temperatures & Health (`tep3c021` & `tep3c022`)

Ideal for the **Digital Twin** and **Interactive Explainer** views showing what is happening inside the nacelle, hub, blades, and tower.

### 3.1 `tep3c021` (Mechanical & Structural Temperatures)
- **Scope:** Asset-level (`wec-1`)
- **Resolutions:** `60s`, `10m`, `daily`

| Field Name | Unit | Component Monitored |
| :--- | :--- | :--- |
| `front_bearing_temperature_mean` | °C | Main rotor front shaft bearing. |
| `rear_bearing_temperature_mean` | °C | Main rotor rear shaft bearing. |
| `spinner_temperature_mean` | °C | Rotor hub aerodynamic spinner dome. |
| `blade_a_temperature_mean` | °C | Rotor blade A pitch root sensor. |
| `blade_b_temperature_mean` | °C | Rotor blade B pitch root sensor. |
| `blade_c_temperature_mean` | °C | Rotor blade C pitch root sensor. |
| `rotor_1_temperature_mean` | °C | Direct-drive generator rotor winding 1. |
| `rotor_2_temperature_mean` | °C | Direct-drive generator rotor winding 2. |
| `cooling_water_temperature_mean` | °C | Generator & power electronics liquid cooling circuit. |
| `nacelle_temperature_mean` | °C | Interior ambient nacelle cabin temperature. |
| `nacelle_control_cabinet_temperature_mean` | °C | Nacelle top-box control computer cabinet. |
| `main_carrier_temperature_mean` | °C | Machine bedplate / structural main carrier casting. |
| `yaw_inverter_cabinet_temperature_mean` | °C | Yaw motor drive variable frequency inverter cabinet. |
| `fan_inverter_cabinet_temperature_mean` | °C | Cooling fan variable speed drive cabinet. |
| `tower_temperature_mean` | °C | Internal structural steel/concrete tower temperature. |
| `control_cabinet_temperature_mean` | °C | Base control cabinet (ground level). |
| `transformer_temperature_mean` | °C | Step-up grid connection transformer (33 kV). |
| `outside_hub_height_temperature_mean` | °C | Ambient outside air temperature at 150m height. |
| `outside_ground_temperature_mean` | °C | Ambient outside air temperature at ground base. |
| `cabinet_a_temperature_mean` | °C | Converter cabinet A. |
| `cabinet_b_temperature_mean` | °C | Converter cabinet B. |
| `cabinet_c_temperature_mean` | °C | Converter cabinet C. |

### 3.2 `tep3c022` (Power Electronics Inverter Cabinet Temperatures)
- **Scope:** Asset-level (`wec-1`)
- **Resolutions:** `60s`, `10m`, `daily`
- **Fields:** `inverter_01_cabinet_temperature_mean` through `inverter_16_cabinet_temperature_mean` (all in °C). Monitors each modular Enercon modular IGBT inverter module.

---

## 4. Grid Substation & Site Controller Signals (`fcu2ctr1` & `fcu2ctr2`)

The Farm Control Unit (FCU E2) monitors the point of common coupling (PCC) to the local Western Power Distribution / National Grid electricity network.

- **Scope:** Asset-level (`controller-2`)
- **Resolutions:** `60s`, `10m`, `daily`
- **Key Fields:**
  - `active_power_mean` (kW): Aggregate active power measured at substation.
  - `reactive_power_mean` (kvar): Net grid reactive power exchange.
  - `apparent_power_mean` (kVA): Total apparent electrical load.
  - `frequency_mean` (Hz): Grid network frequency (nominally 50 Hz ± 0.5 Hz).
  - `line_to_line_voltage_mean` (V): Medium voltage grid busbar voltage.
  - `voltage_l12_mean`, `voltage_l23_mean`, `voltage_l31_mean` (V): Phase-to-phase voltages.
  - `voltage_l1n_mean`, `voltage_l2n_mean`, `voltage_l3n_mean` (V): Phase-to-neutral voltages.
  - `current_l1_mean`, `current_l2_mean`, `current_l3_mean` (A): 3-phase line currents.
  - `energy_produced` (kWh) & `energy_consumed` (kWh): Fiscal-grade import/export meters.

---

## 5. Event & Operational Status Signals (`status`)

- **Endpoint:** `/v1/sites/ace/assets/wec-1/events/status/latest`
- **Purpose:** Turbine state machine monitoring, maintenance flags, and curtailment indicators.

| Field Name | Type | Value Range / Meaning |
| :--- | :--- | :--- |
| `main_status` | Integer | Operational state: `0` = Ready / Generating, `1` = Paused / Idling, `2` = Starting, `9` = Fault / Maintenance. |
| `substatus` | Integer | Detailed subsystem state code. |
| `fault_message_flag` | Flag (0/1) | `1` indicates an active trip or critical system fault; `0` = normal operation. |
| `warning_message_flag` | Flag (0/1) | `1` indicates an advisory warning condition (e.g. high temperature or high wind gust near cut-out). |
| `service_flag` | Flag (0/1) | `1` indicates scheduled maintenance mode / technicians on-site. |
| `information` | Integer | Diagnostic event ID. |
| `additional_information` | Integer | Diagnostic subcode. |

---

## 6. Static Technical Specifications

| Specification Metric | Value | Technical Context |
| :--- | :--- | :--- |
| **Site Location** | Avonmouth / Lawrence Weston, Bristol, UK | Coords: `51.537917°N, -2.674000°W` |
| **Turbine Model** | Enercon E-115 EP3 (`EP3-CS02`) | Direct-drive gearless synchronous generator |
| **Rated Capacity** | 4.2 MW (4,245 kW) | Nominal farm limit: 4,200 kW (setpoint capped) |
| **Hub Height** | 150 meters (490 ft) | Tallest onshore wind turbine in England |
| **Rotor Diameter** | 115.7 meters (380 ft) | Swept area: 10,514 m² (~1.5 football pitches) |
| **Tip Height** | 207.8 meters (682 ft) | Taller than the London Eye (135m) |
| **Cut-in Wind Speed** | 2.5 m/s | Blades start rotating and producing net power |
| **Rated Wind Speed** | 12.5 m/s | Reaches full 4.2 MW capacity |
| **Cut-out Wind Speed** | 28.0 – 34.0 m/s | Storm control pitch-out to protect structure |
| **Commercial Start** | March 29, 2023 | 100% community owned by ACE CIC |
| **Annual Generation** | ~10,500,000 kWh/year | Powers ~3,500 – 4,000 average UK homes |
| **CO₂ Offset Factor** | ~0.207 kg CO₂ / kWh | UK Grid Electricity carbon displacement factor |
