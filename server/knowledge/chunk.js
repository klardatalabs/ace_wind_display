// Splits cleaned pages into passages for retrieval. A passage never crosses a section
// boundary, carries its section heading and page range, holds about 250 tokens (well under
// the embedding model's 512-token input limit), and overlaps its neighbour by a sentence or
// two so an idea split across a boundary is still found whole.

const TARGET_CHARS = 1_100;
const MAX_CHARS = 1_700;
const OVERLAP_CHARS = 220;

// Sentence boundaries from ICU, which knows "Figure 5.7" and "1.35" are not sentence ends.
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const sentencesOf = (text) => [...segmenter.segment(text)].map((s) => s.segment.trim()).filter(Boolean);

/** Breaks an over-long sentence (tables, run-on lists) into pieces of at most MAX_CHARS. */
function* bounded(sentence) {
  for (let i = 0; i < sentence.length; i += MAX_CHARS) yield sentence.slice(i, i + MAX_CHARS);
}

/**
 * @param {Array<{ number: number, lines: Array<{ text: string, heading?: string }> }>} pages
 * @returns {Array<{ position: number, pageStart: number, pageEnd: number, section: string|null, text: string }>}
 */
export function chunkPages(pages) {
  const passages = [];
  let section = null;
  let buffer = []; // [{ sentence, page }]

  const flush = ({ keepOverlap }) => {
    const text = buffer.map((b) => b.sentence).join(" ").trim();
    if (text.length >= 80) {
      passages.push({ position: passages.length + 1, pageStart: buffer[0].page, pageEnd: buffer.at(-1).page, section, text });
    }
    if (!keepOverlap) {
      buffer = [];
      return;
    }
    // Carry the last sentence(s), up to OVERLAP_CHARS, into the next passage.
    const carried = [];
    let size = 0;
    for (let i = buffer.length - 1; i >= 0 && size + buffer[i].sentence.length <= OVERLAP_CHARS; i--) {
      carried.unshift(buffer[i]);
      size += buffer[i].sentence.length;
    }
    buffer = carried;
  };

  for (const page of pages) {
    // Lines within a page are re-joined into running text, split at headings.
    let running = "";
    const emit = () => {
      for (const sentence of sentencesOf(running)) {
        for (const piece of bounded(sentence)) {
          const length = buffer.reduce((n, b) => n + b.sentence.length + 1, 0);
          if (length + piece.length > TARGET_CHARS && buffer.length) flush({ keepOverlap: true });
          buffer.push({ sentence: piece, page: page.number });
        }
      }
      running = "";
    };
    for (const line of page.lines) {
      if (line.heading) {
        emit();
        flush({ keepOverlap: false });
        section = line.heading;
        continue;
      }
      running += `${line.text} `;
    }
    emit();
  }
  flush({ keepOverlap: false });
  return passages;
}

/** What is stored and shown: the section heading (when known) above the passage text. */
export const passageContent = (p) => (p.section ? `${p.section}\n${p.text}` : p.text);

/** What is embedded: the book title adds context that helps retrieval. */
export const passageForEmbedding = (title, p) => `${title}\n${passageContent(p)}`;
