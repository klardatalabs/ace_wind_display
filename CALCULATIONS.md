# Environmental & Physics Calculation Engine (`CALCULATIONS.md`)

*Ambition Community Energy (ACE) Wind Turbine — Validated Equivalents & Conversion Formulas*

This document provides transparent, documented formulas, data sources, ddassumptions, and units for all calculations presented across the public display screens, educational modules, and conversational AI assistant.

---

## 1. Homes Powered Equivalent

### Formula
$$\text{Homes Powered} = \left\lfloor \frac{P_{\text{active}} (\text{kW})}{\text{Demand}_{\text{home}} (\text{kW})} \right\rfloor$$

- **Immediate Power Demand:** $\text{Demand}_{\text{home}} = 0.90\text{ kW}$ (coincident peak/average domestic demand per UK household).
- **Daily Energy Demand:** $\text{Daily Energy}_{\text{home}} = \frac{2,900\text{ kWh}}{365\text{ days}} \approx 7.95\text{ kWh/day}$ (rounded to $8.2\text{ kWh/day}$ including distribution loss allowances).

### Sources & Assumptions
- **Source:** Ofgem Typical Domestic Consumption Values (TDCVs) Profile Class 1 (Medium electricity usage = 2,900 kWh/annum).
- **Assumptions:** Real-time electricity instantaneous load includes domestic lighting, refrigeration, cooking, and appliances without electric space heating.

---

## 2. Avoided Carbon Pollution ($\text{CO}_2$ kg)

### Formula
$$\text{Avoided }\text{CO}_2\text{ (kg)} = \text{Energy Generated (kWh)} \times \text{Grid Carbon Intensity Factor}$$

- **Factor:** $0.207\text{ kg CO}_2\text{e per kWh}$ ($207\text{ g CO}_2/\text{kWh}$).

### Sources & Assumptions
- **Source:** UK Department for Energy Security and Net Zero (DESNZ) & Department for Environment, Food and Rural Affairs (DEFRA) *Government greenhouse gas conversion factors for company reporting* (UK Electricity Grid Rolling Average).
- **Assumptions:** Displaces marginal fossil-fuel generation (combined cycle gas turbine / CCGT) on the National Grid transmission network.

---

## 3. Tree Offset Equivalent (Broadleaf Trees)

### Formula
$$\text{Tree Equivalent} = \frac{\text{Avoided }\text{CO}_2\text{ (kg)}}{\text{Absorption Rate}_{\text{tree}}}$$

- **Annual Tree Absorption Rate:** $22.0\text{ kg CO}_2\text{ per mature broadleaf tree per year}$ ($1.83\text{ kg CO}_2\text{/month}$).

### Sources & Assumptions
- **Source:** UK Forestry Commission / European Environment Agency (EEA) urban forestry carbon sequestration benchmarks.
- **Assumptions:** Average mature deciduous broadleaf tree (oak, beech, or maple) growing in temperate maritime UK climates.

---

## 4. Community Prosperity Dividend (Fuel Poverty & Warm Hubs)

### Formula
$$\text{Community Fund (\pounds)} = \left(\frac{\text{Energy Generated (kWh)}}{1,000}\right) \times \text{Fund Rate (\pounds/MWh)}$$

- **Fund Contribution Rate:** $\pounds 3.50\text{ per MWh}$ (indicative minimum operational surplus).

### Sources & Assumptions
- **Source:** Ambition Community Energy CIC financial model and Lawrence Weston Community Development Project business plan.
- **Assumptions:** 100% of operational revenue surplus after debt service (Thrive Renewables / Triodos Bank) and maintenance contracts is directed to local Lawrence Weston community fuel-poverty insulation funds and warm home hubs.

---

## 5. Aerodynamic Blade Tip Speed

### Formula
$$v_{\text{tip}} (\text{m/s}) = \frac{\text{Rotor RPM} \times 2 \times \pi \times R}{60}$$
$$v_{\text{tip}} (\text{mph}) = v_{\text{tip}} (\text{m/s}) \times 2.23694$$

- **Rotor Radius ($R$):** $57.5\text{ m}$ (rotor diameter = $115.0\text{ m}$ on Enercon E-115 EP3).
- **Circumference:** $2 \times \pi \times 57.5 = 361.28\text{ metres}$ swept per full revolution.

### Examples:
- At idle ($3.0\text{ RPM}$): $v_{\text{tip}} = 18.1\text{ m/s}$ ($40.4\text{ mph}$).
- At nominal ($10.5\text{ RPM}$): $v_{\text{tip}} = 63.2\text{ m/s}$ ($141.4\text{ mph}$).
- At rated top speed ($13.8\text{ RPM}$): $v_{\text{tip}} = 83.1\text{ m/s}$ ($185.9\text{ mph}$ — faster than the world's fastest cheetah).

---

## 6. Operational Capacity Factor (%)

### Formula
$$\text{Capacity Factor (\%)} = \frac{\text{Actual Energy Generated (kWh)}}{\text{Rated Capacity (kW)} \times \text{Period Duration (Hours)}} \times 100\%$$

- **Rated Generator Capacity:** $4,200\text{ kW}$ ($4.2\text{ MW}$).
- **Single-Day Benchmark:** $\text{Max Daily Generation} = 4,200\text{ kW} \times 24\text{ h} = 100,800\text{ kWh}$.
  - Record Day (18 Sept 2026): $76,239\text{ kWh} / 100,800\text{ kWh} = \mathbf{75.6\%}$ capacity factor!

---

## 7. IEC 61400-12-1 Empirical Power Curve Binning

### Method of Bins:
- Measured 10-minute mean wind speed $v_i$ is partitioned into discrete $0.5\text{ m/s}$ bins centered at $v_k = 0.5 \times k$ ($k \in [1, 50]$):
  $$\text{Bin}_k = [v_k - 0.25\text{ m/s}, v_k + 0.25\text{ m/s})$$
- For each bin, the normalized empirical power $P_k$ is the arithmetic mean of all samples $N_k$:
  $$P_k = \frac{1}{N_k} \sum_{i \in \text{Bin}_k} P_{\text{active}, i}$$
- Standard deviation $\sigma_k$ and sample count $N_k$ are returned by `GET /api/history/power-curve` (drawn on the College screen and in the admin console) across all **11,219 TimescaleDB SCADA rows**.
