// Dark code panel with a filename tab and a copy button.

import { useState } from "react";
import Icon from "./Icon.jsx";

export default function CodeBlock({ code, title, language = "", className = "" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; the text is selectable anyway
    }
  };
  return (
    <div className={`overflow-hidden rounded-2xl bg-moss-950 ring-1 ring-moss-900 ${className}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-moss-200">{title || language}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-moss-100 transition hover:bg-white/10" aria-label="Copy code">
          <Icon name={copied ? "check" : "copy"} className="size-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-moss-50">
        <code>{code}</code>
      </pre>
    </div>
  );
}
