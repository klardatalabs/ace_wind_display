import { CURATED_SOURCES } from "./curated.js";

// Extra references are links for visitors, not documents the chatbot can search yet.
export const FURTHER_READING = [
  {
    id: "doe-small-wind-guidebook", sourceType: "book", title: "Small Wind Guidebook",
    author: "U.S. Department of Energy", year: null,
    sourceUrl: "https://www.energy.gov/cmei/systems/windexchange/small-wind-guidebook",
    topic: "Wind fundamentals, siting and energy estimates",
  },
  {
    id: "ace-zenodo-data", sourceType: "dataset", title: "ACE Wind Turbine Data",
    author: "Ambition Community Energy and collaborators", year: 2026,
    sourceUrl: "https://zenodo.org/records/23114177",
    topic: "Site measurements, configuration and data provenance",
  },
  {
    id: "openfast-documentation", sourceType: "paper", title: "OpenFAST documentation",
    author: "OpenFAST contributors", year: null,
    sourceUrl: "https://openfast.readthedocs.io/en/main/",
    topic: "Advanced aeroelastic simulation methods; not an ACE-specific model",
  },
  {
    id: "enercon-e115-ep3-spec", sourceType: "paper", title: "ENERCON E-115 EP3 technical data",
    author: "ENERCON", year: 2020,
    sourceUrl: "https://www.hannovermesse.de/apollo/hannover_messe_2021/obs/Binary/A1088808/EC_Datenbl%C3%A4tter_E-115%20EP3_en_022020.pdf",
    topic: "Manufacturer reference; confirm ACE's installed variant before using its values",
  },
  {
    id: "iea-22mw-reference", sourceType: "paper", title: "Definition of the IEA Wind 22-Megawatt Offshore Reference Wind Turbine",
    author: "IEA Wind Task 55", year: 2024,
    sourceUrl: "https://iea-wind.org/task55/task-55-publications/",
    topic: "Reference turbine design for research",
  },
];

export function buildLibrary(documents = [], status = "ready") {
  const loaded = new Set(documents.filter((d) => d.passages > 0).map((d) => d.sourceUrl));
  const sources = [...CURATED_SOURCES.map((s) => ({ ...s, topic: "Wind energy research" })), ...FURTHER_READING];
  return {
    status,
    items: sources.map(({ id, sourceType, title, author, year, sourceUrl, topic }) => ({
      id, type: sourceType, title, author, year, url: sourceUrl, topic,
      chatReady: status === "ready" && Boolean(CURATED_SOURCES.find((s) => s.sourceUrl === sourceUrl)?.indexable) && loaded.has(sourceUrl),
    })),
  };
}
