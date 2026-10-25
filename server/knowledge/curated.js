// Reviewed public research shortlist. PDFs are downloaded only by the admin CLI and remain
// in ignored ingestion/; the public repository contains metadata and source links only.
export const CURATED_SOURCES = [
  {
    id: "gipe-wind-energy-1995", sourceType: "book", title: "Wind Energy Comes of Age",
    author: "Paul Gipe", year: 1995,
    sourceUrl: "https://archive.org/details/windenergycomeso00gipe",
    downloadUrl: "https://archive.org/download/windenergycomeso00gipe/windenergycomeso00gipe.pdf",
    rightsNote: "Author placed the book in the public domain in 2025; historic statistics may be outdated.",
  },
  {
    id: "nrel-design-2024", sourceType: "paper", title: "Wind Turbine Design Optimization for Hydrogen Production",
    author: "Jared J. Thomas, Cameron Irmas, Genevieve Starke and co-authors", year: 2024,
    sourceUrl: "https://docs.nlr.gov/docs/fy24osti/89660.pdf",
    downloadUrl: "https://docs.nlr.gov/docs/fy24osti/89660.pdf",
    rightsNote: "Openly available NREL report; cite the original and do not redistribute the PDF from this repository.",
  },
  {
    id: "nrel-reference-2020", sourceType: "paper", title: "Definition of the IEA 15-Megawatt Offshore Reference Wind Turbine",
    author: "Evan Gaertner, Jennifer Rinker, Latha Sethuraman and co-authors", year: 2020,
    sourceUrl: "https://docs.nlr.gov/docs/fy20osti/75698.pdf",
    downloadUrl: "https://docs.nlr.gov/docs/fy20osti/75698.pdf",
    rightsNote: "Openly available NREL technical report; cite the original and do not redistribute the PDF from this repository.",
  },
  {
    id: "us7109600b1", sourceType: "patent", title: "US7109600B1: Direct drive wind turbine",
    author: "Garrett Lee Bywaters and co-inventors", year: 2006,
    sourceUrl: "https://patents.google.com/patent/US7109600B1/en",
    downloadUrl: "https://patentimages.storage.googleapis.com/09/57/af/2d61adc4b6469c/US7109600.pdf",
    rightsNote: "Published patent specification; a described invention is not evidence of ACE's equipment.",
  },
  {
    id: "us6137187a", sourceType: "patent", title: "US6137187A: Variable speed wind turbine generator",
    author: "Amir S. Mikhail and co-inventors", year: 2000,
    sourceUrl: "https://patents.google.com/patent/US6137187A/en",
    downloadUrl: "https://patentimages.storage.googleapis.com/14/26/71/fb3f9182a5077b/US6137187.pdf",
    rightsNote: "Published patent specification; a described invention is not evidence of ACE's equipment.",
  },
];
