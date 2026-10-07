// Retrieval for Ace: markdown documents chunked by heading and ranked with BM25.
// Small, dependency-free and fast enough to rebuild at boot.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..", "..");

// Curated fact sheet first; project docs add depth for technical questions.
const KNOWLEDGE_FILES = [
  "server/knowledge/docs/weston-wind.md",
  "PROJECT_OVERVIEW.md",
  "DATA_SOURCES.md",
  "DATA_DICTIONARY.md",
  "API_REFERENCE.md",
  "exploratory analysis.md",
];

const STOPWORDS = new Set(
  "the and for are was were with that this from what how why when who your you our its it's into about have has had does did can not but all any per than then them they their there here".split(" ")
);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function chunkMarkdown(markdown, source) {
  const chunks = [];
  let heading = "Overview";
  let lines = [];
  const flush = () => {
    const content = lines.join("\n").trim();
    if (content.length > 40) chunks.push({ heading, source, content });
    lines = [];
  };
  for (const line of markdown.split("\n")) {
    if (/^#{1,4}\s/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, "").trim();
    } else {
      lines.push(line);
    }
  }
  flush();
  return chunks;
}

class KnowledgeBase {
  constructor() {
    this.chunks = [];
    this.docFreq = new Map();
    this.avgLength = 1;
  }

  build() {
    this.chunks = [];
    for (const rel of KNOWLEDGE_FILES) {
      const full = path.join(ROOT_DIR, rel);
      if (!fs.existsSync(full)) continue;
      for (const chunk of chunkMarkdown(fs.readFileSync(full, "utf8"), rel)) {
        const tokens = tokenize(`${chunk.heading} ${chunk.heading} ${chunk.content}`);
        const tf = new Map();
        for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
        this.chunks.push({ ...chunk, tf, length: tokens.length });
      }
    }
    this.docFreq = new Map();
    for (const chunk of this.chunks) for (const term of chunk.tf.keys()) this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    this.avgLength = this.chunks.reduce((s, c) => s + c.length, 0) / Math.max(1, this.chunks.length);
    console.log(`[knowledge] indexed ${this.chunks.length} chunks from ${KNOWLEDGE_FILES.length} documents`);
  }

  search(query, topK = 4) {
    if (!this.chunks.length) this.build();
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const N = this.chunks.length;
    const k1 = 1.4;
    const b = 0.75;
    return this.chunks
      .map((chunk) => {
        let score = 0;
        for (const term of terms) {
          const f = chunk.tf.get(term);
          if (!f) continue;
          const df = this.docFreq.get(term) || 0;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * chunk.length) / this.avgLength)));
        }
        // Prefer the curated fact sheet when scores are close.
        if (score > 0 && chunk.source.endsWith("weston-wind.md")) score *= 1.25;
        return { chunk, score };
      })
      .filter((r) => r.score > 0.5)
      .sort((a, b2) => b2.score - a.score)
      .slice(0, topK)
      .map(({ chunk, score }) => ({
        heading: chunk.heading,
        source: chunk.source,
        content: chunk.content.slice(0, 1400),
        score: Number(score.toFixed(2)),
      }));
  }
}

export const knowledgeBase = new KnowledgeBase();
knowledgeBase.build();
