import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");

// List of project Markdown documentation to index into the RAG knowledge base
const KNOWLEDGE_FILES = [
  "README.md",
  "DATA_SOURCES.md",
  "API_REFERENCE.md",
  "DATA_DICTIONARY.md",
  "PROJECT_OVERVIEW.md",
  "PUBLIC_EXPERIENCE_BLUEPRINT.md",
  "exploratory analysis.md",
  "docs/SYSTEM_DESIGN.md",
];

export class RagKnowledgeBase {
  constructor() {
    this.chunks = [];
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.chunks = [];

    for (const relPath of KNOWLEDGE_FILES) {
      const fullPath = path.join(ROOT_DIR, relPath);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const text = fs.readFileSync(fullPath, "utf8");
        const docChunks = this.chunkMarkdown(text, relPath);
        this.chunks.push(...docChunks);
      } catch (err) {
        console.warn(`[RAG] Failed to index ${relPath}:`, err.message);
      }
    }

    console.log(`[RAG] Knowledge Base initialized with ${this.chunks.length} semantic chunks across ${KNOWLEDGE_FILES.length} documents.`);
    this.initialized = true;
  }

  chunkMarkdown(markdown, sourceFile) {
    const lines = markdown.split("\n");
    const chunks = [];
    let currentHeading = "General Overview";
    let currentLines = [];

    for (const line of lines) {
      if (line.startsWith("#")) {
        if (currentLines.length > 0) {
          const content = currentLines.join("\n").trim();
          if (content.length > 50) {
            chunks.push(this.createChunk(currentHeading, content, sourceFile));
          }
          currentLines = [];
        }
        currentHeading = line.replace(/^#+\s*/, "").trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const content = currentLines.join("\n").trim();
      if (content.length > 50) {
        chunks.push(this.createChunk(currentHeading, content, sourceFile));
      }
    }

    return chunks;
  }

  createChunk(heading, content, source) {
    const rawTokens = (heading + " " + content)
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const termFreq = {};
    for (const token of rawTokens) {
      termFreq[token] = (termFreq[token] || 0) + 1;
    }

    return {
      heading,
      source,
      content,
      tokens: termFreq,
      tokenCount: rawTokens.length,
    };
  }

  search(query, topK = 3) {
    if (!this.initialized) this.init();

    const qTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (qTokens.length === 0) return [];

    const scored = this.chunks.map((chunk) => {
      let score = 0;
      for (const q of qTokens) {
        // Direct term frequency score
        if (chunk.tokens[q]) {
          score += (chunk.tokens[q] / (chunk.tokenCount + 10)) * 5;
        }
        // Substring / heading bonus
        if (chunk.heading.toLowerCase().includes(q)) {
          score += 3.0;
        }
      }
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter((s) => s.score > 0.05)
      .slice(0, topK)
      .map((s) => ({
        heading: s.chunk.heading,
        source: s.chunk.source,
        content: s.chunk.content,
        score: Number(s.score.toFixed(3)),
      }));
  }
}

export const rag = new RagKnowledgeBase();
rag.init();
