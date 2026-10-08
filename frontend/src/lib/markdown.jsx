// Tiny, safe renderer for chat replies: paragraphs, line breaks, bullet / numbered lists,
// **bold** and *italic*. Builds React elements — never injects HTML.

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) out.push(<strong key={`${keyBase}-${i++}`} className="font-semibold">{token.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-${i++}`}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

/** Splits a block into runs of plain lines, bullet items and numbered items. */
function runs(lines) {
  const out = [];
  for (const line of lines) {
    const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : "p";
    const text = kind === "ul" ? line.replace(BULLET, "") : kind === "ol" ? line.replace(NUMBERED, "") : line.replace(/^#+\s*/, "");
    const prev = out[out.length - 1];
    if (prev?.kind === kind) prev.lines.push(text);
    else out.push({ kind, lines: [text] });
  }
  return out;
}

export function Markdown({ text }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return blocks.flatMap((block, bi) =>
    runs(block.split("\n").filter((l) => l.trim() !== "")).map((run, ri) => {
      const key = `${bi}-${ri}`;
      if (run.kind === "ul" || run.kind === "ol") {
        const List = run.kind;
        return (
          <List key={key} className={`my-1.5 space-y-1 pl-5 ${run.kind === "ul" ? "list-disc" : "list-decimal"}`}>
            {run.lines.map((l, li) => (
              <li key={li}>{inline(l, `${key}-${li}`)}</li>
            ))}
          </List>
        );
      }
      return (
        <p key={key} className="my-1.5 first:mt-0 last:mb-0">
          {run.lines.map((l, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {inline(l, `${key}-${li}`)}
            </span>
          ))}
        </p>
      );
    })
  );
}
