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
    id: "nrel-wind-resource-handbook", sourceType: "book", title: "Wind Resource Assessment Handbook",
    author: "AWS Scientific for NREL", year: 1997,
    sourceUrl: "https://www.nrel.gov/docs/legosti/fy97/22223.pdf",
    topic: "Measuring and interpreting wind resources",
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
      chatReady: status === "ready" && loaded.has(sourceUrl),
    })),
  };
}
