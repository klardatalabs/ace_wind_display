# What-if Studio: data and calculation provenance

The [ACE Wind Turbine Data archive](https://zenodo.org/records/23114177) publishes static turbine details, configuration, events, 10-minute and 60-second SCADA, and 60-second and approximately one-second instantaneous data under CC BY 4.0. Its file categories are confirmed; the fields below are the subset **currently ingested by this application**, not an exhaustive list of ACE's published sensors. The archive's configuration Parquet columns still need direct review before being offered as scenario controls.

| App value | Unit | Current source | Quality/freshness | Studio use |
| --- | --- | --- | --- | --- |
| Turbine wind speed | m/s | ACE one-second live API; 10-minute SCADA history | Live collector checks good quality, range and ≤30-second age | Editable hypothetical wind speed |
| Site wind direction | degrees | ACE one-second live API | Same live checks | Editable hypothetical direction; turns model only |
| Active power | kW | ACE one-second live API; 10-minute SCADA history | Live checks and historical quality filters | Observed baseline and historical curve; never overwritten |
| Rotor speed | rpm | ACE one-second live API; 10-minute SCADA history | Same as above | Observed measurement; Studio animation is an approximation |
| Nacelle bearing | degrees | ACE one-second live API; 10-minute SCADA history | Same as above | Observed measurement; hypothetical direction turns the model |
| Exported energy | kWh | ACE one-second live API | Same live checks | Observed meter; scenario energy uses estimated kW × hours |
| Available power after external setpoints | kW | ACE one-second site API | Same live checks | Initial hypothetical grid limit when valid |
| Operating status/fault flags | codes/flags | ACE latest status event | Good-quality event validation | Context only, not a controllable scenario input |
| Air density assumption | kg/m³ | Visitor entry; 1.225 reference default | Not measured by ACE in this app | Calculates wind power density, not electrical power; [DOE method](https://www.energy.gov/cmei/systems/windexchange/small-wind-guidebook) |
| Operating fraction assumption | % | Visitor entry; 100% default | Hypothetical, not a forecast | Scales hours and energy, not instantaneous power |

The technical panel additionally calculates wind power density (½ρv³), wind power across the app's configured rotor swept area, and illustrative blade-tip speed from the animated rpm. These are **not** measured ACE sensors or validated electrical-output predictions. Average power over the selected period equals estimated power while operating times the assumed operating fraction; energy is that average power times duration. At 0% operating fraction the animation stops.

The app does not currently ingest blade pitch, vibration, bearing loads, torque, or component temperatures. Their absence from this table does **not** establish that the physical turbine lacks these sensors. Weather readings such as temperature and pressure come from OpenWeather, not ACE instrumentation.

The repo identifies the asset as `E-115 EP3` and seeds 4,245 kW rated power, 115.7 m rotor diameter, and a 4,200 kW grid setpoint. ACE's [archive description](https://zenodo.org/records/23114177) calls it a 4.2 MW turbine. The exact installed variant, configuration values and the provenance of the points in `shared/physics.js` need confirmation against the archive/OEM records. Until then, that code's curve is labelled **illustrative only**, and its rotor-speed relation is used for visual motion rather than as a predicted sensor value.

When sufficient site history is available, the scenario engine interpolates observed power-curve bins with at least 30 samples per bin and at least six usable bins. It returns no power outside the covered wind-speed range. Observational averages are not forecasts: control state, availability, turbulence, air density and other conditions can change actual output. Baseline and scenario energy use the same duration for comparison.
