# Weston Wind — Fact Sheet for Ace

Curated, source-checked facts the chatbot may quote. Sources: PROJECT_OVERVIEW.md,
DATA_SOURCES.md and shared/constants.js in this repository.

## Who owns the turbine
The turbine is run by Ambition Community Energy (ACE), a community interest company (CIC)
set up by residents of Lawrence Weston, Bristol, UK. ACE was created through Ambition
Lawrence Weston (ALW), a resident-led, open-membership regeneration charity. The turbine's
sole purpose is to generate clean energy and long-term income that supports ALW's work
tackling deprivation, fuel poverty and inequality in Lawrence Weston.

## The machine
- Model: Enercon E-115 EP3 (WEC type EP3-CS02), a gearless direct-drive turbine.
- Capacity: 4.2 MW (nominal power 4,245 kW, grid setpoint 4,200 kW).
- Tip height 150 metres (the tallest onshore wind turbine in England); hub height about 92 metres;
  rotor diameter 115.7 metres; the tower is about 89 metres tall. Some older project notes say
  "hub 150 m / tip 208 m" — that is wrong; 150 m is the tip height (source: Thrive Renewables and
  Bristol24/7 coverage of the build).
- Location: Avonmouth / Lawrence Weston, Bristol, near the Severn Estuary.
- Commissioned: spring 2023 (operational data begins 29 March 2023).

## When it spins
- Cut-in wind speed: about 2.5 m/s. Below this the blades idle and wait for wind.
- Rated wind speed: about 12.5 m/s, where it reaches full power.
- Storm protection: it reduces power in very strong winds (around 28 m/s) and stops
  at about 34 m/s to protect itself.

## How a direct-drive turbine works
The wind pushes the three blades, which turn the hub. On a direct-drive (gearless) Enercon,
the hub is connected straight to a large ring generator (an annular generator) without a
gearbox. Magnets and copper coils inside the generator turn the motion into electricity.
A converter cleans up the electricity so it matches the grid, and a transformer at the
tower base raises the voltage before it leaves the site. The nacelle (machine house on top)
turns to face the wind using yaw drives on a big toothed ring at the top of the tower.
Engineers climb a ladder or use a small service lift inside the tower to reach the nacelle.

## How we turn numbers into everyday things
- Homes powered right now = live power (kW) ÷ 0.35 kW, the average UK household demand.
- Carbon avoided = energy (kWh) × 0.207 kg CO2 per kWh (UK grid factor).
- Tree equivalent ≈ 21 kg CO2 absorbed per mature tree per year (a commonly cited estimate).
- Community money figures shown on screen are estimates, not official accounts.

## Open data
ACE publishes turbine data openly under the Creative Commons Attribution 4.0 (CC-BY-4.0)
licence. Live data comes from the ACE Live API (https://ace-api.duckdns.org/docs). History is
archived monthly on Zenodo (concept DOI 10.5281/zenodo.22662372) by Charlie Plumley,
Andrew Garrad, Wilf Burke, Christian Jonsson and Andrew Smirthwaite.

## The Weston Wind displays
Weston Wind is the public display for the turbine. Three big screens tell the story for
students, the community and colleges. Anyone can scan the QR code on a screen to chat with
Ace, the turbine's voice, from their phone. No login is needed and each chat is private to
that phone's browser tab.
