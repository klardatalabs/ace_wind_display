// Text out of a document, page by page: PDF (unpdf), Word (mammoth), plain text, Markdown.

import fs from "node:fs/promises";
import path from "node:path";
import { getDocumentProxy, extractText, getMeta } from "unpdf";
import mammoth from "mammoth";

const MEDIA_TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export const supportedExtensions = Object.keys(MEDIA_TYPES);

/** Metadata titles that are file artefacts rather than real titles (e.g. "HWE-PRE 1..26"). */
const usableTitle = (t) => typeof t === "string" && t.trim().length > 3 && !/\.\.|^untitled|\.(pdf|docx?)$/i.test(t.trim());

/**
 * @returns {Promise<{ bytes: Buffer, mediaType: string, title: string|null, author: string|null,
 *   pages: Array<{ number: number, text: string }> }>}
 */
export async function extractDocument(file) {
  const ext = path.extname(file).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) throw new Error(`Unsupported file type ${ext} (supported: ${supportedExtensions.join(", ")})`);
  const bytes = await fs.readFile(file);

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const [{ text }, meta] = await Promise.all([extractText(pdf, { mergePages: false }), getMeta(pdf).catch(() => ({}))]);
    return {
      bytes,
      mediaType,
      title: usableTitle(meta.info?.Title) ? meta.info.Title.trim() : null,
      author: typeof meta.info?.Author === "string" ? meta.info.Author.replace(/\s*\(Author\)\s*/g, "").trim() || null : null,
      pages: text.map((t, i) => ({ number: i + 1, text: t })),
    };
  }
  const text = ext === ".docx" ? (await mammoth.extractRawText({ buffer: bytes })).value : bytes.toString("utf8");
  return { bytes, mediaType, title: null, author: null, pages: [{ number: 1, text }] };
}
