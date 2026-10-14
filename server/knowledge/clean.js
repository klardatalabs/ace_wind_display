// Turns raw page text into clean lines a reader (and a search index) can use: running
// headers and footers, page numbers, equation garbage and contents/index/reference pages
// are removed; words split across lines are joined; section headings are recognised.

// A heading like "3.4.4 Airfoil Behavior" or "2.10 Turbulence in Wakes and Wind Farms".
const NUMBERED_HEADING = /^(\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+([A-Z][^.!?]{2,90})$/;
const BACK_MATTER = /^(references|bibliography|index|further reading|contents|list of symbols|acknowledg(e)?ments|problems|exercises)$/i;

/** End-of-chapter exercises ("2.10 A wind turbine with a rotor diameter of 55 m...") are not headings. */
const isHeadingText = (text) => !/\d/.test(text) && text.split(/\s+/).length <= 10;

// Ordinary prose: Latin and Greek letters, digits, whitespace, punctuation and common symbols.
const ORDINARY = /[\p{Script=Latin}\p{Script=Greek}\d\s.,;:!?'"()\[\]{}%/+\-=*×·°–—’‘“”&<>^_~$#@|]/gu;

/** Share of characters outside ordinary text (high on lines that are mostly equation glyphs). */
function garbleRatio(line) {
  return line.replace(ORDINARY, "").length / Math.max(1, line.length);
}

/** Removes stray non-text glyphs (mis-encoded equation fonts) from an otherwise readable line. */
const stripGlyphs = (line) => line.replace(/[^\p{Script=Latin}\p{Script=Greek}\d\s.,;:!?'"()\[\]{}%/+\-=*×·°–—’‘“”&<>^_~$#@|]/gu, " ");

/** Lines that repeat on many pages (running heads, footers) after digits are removed. */
function repeatedLines(pages) {
  const counts = new Map();
  for (const page of pages) {
    const seen = new Set();
    for (const raw of page.text.split("\n")) {
      const key = raw.replace(/\d+/g, "").trim().toLowerCase();
      if (key && key.length <= 80 && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.max(4, pages.length * 0.08);
  return new Set([...counts].filter(([, n]) => n >= threshold).map(([key]) => key));
}

/** A page that is mostly "something .... 123" lines: contents, index or list of figures. */
function looksLikeListingPage(lines) {
  if (lines.length < 6) return false;
  const listed = lines.filter((l) => /(\.\s?){3,}\s*\d+$|,\s*\d+(?:[–-]\d+)?(?:,\s*\d+(?:[–-]\d+)?)*$|^\d+(\.\d+)*\s+.+\s\d{1,4}$/.test(l)).length;
  return listed / lines.length > 0.45;
}

/**
 * @param {Array<{ number: number, text: string }>} pages
 * @returns {Array<{ number: number, lines: Array<{ text: string, heading?: string }> }>}
 */
export function cleanPages(pages) {
  const repeated = repeatedLines(pages);
  let inBackMatter = false;
  const out = [];
  for (const page of pages) {
    // Join words hyphenated across a line break ("wind-\nfarm" -> "wind-farm").
    const text = page.text.replace(/(\p{L})-\n(\p{Ll})/gu, "$1-$2");
    const lines = text
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l && !/^\d{1,4}$/.test(l) && !repeated.has(l.replace(/\d+/g, "").trim().toLowerCase()))
      .filter((l) => garbleRatio(l) < 0.2)
      .map((l) => stripGlyphs(l).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (looksLikeListingPage(lines)) continue;

    const kept = [];
    for (const line of lines) {
      const bare = line.replace(/^\d+(\.\d+)*\s+/, "");
      if (BACK_MATTER.test(bare)) {
        inBackMatter = true;
        continue;
      }
      const numbered = line.match(NUMBERED_HEADING);
      if (numbered && line.length <= 100 && isHeadingText(numbered[2])) {
        inBackMatter = false;
        kept.push({ text: line, heading: `${numbered[1]} ${numbered[2].trim()}` });
        continue;
      }
      if (!inBackMatter) kept.push({ text: line });
    }
    if (kept.length) out.push({ number: page.number, lines: kept });
  }
  return out;
}
