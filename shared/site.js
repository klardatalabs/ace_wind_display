// The one place the turbine's identity and location are defined. The server seeds the
// database from this file and the frontend imports it directly, so they can never disagree.

export const SITE = {
  id: "ace",
  name: "Lawrence Weston",
  // ACE's mapped foundation: OpenStreetMap node 14249020525.
  lat: 51.5378881,
  lon: -2.6740022,
  timeZone: "Europe/London",
};

export const ASSET = {
  id: "wec-1",
  modelId: "E-115 EP3",
  commissionedOn: "2023-03-29",
};
