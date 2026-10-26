import { useEffect, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon.jsx";
import { api } from "../../../lib/api.js";

const TYPES = [
  { key: "book", title: "Bookshelf", note: "Books and longer guides" },
  { key: "paper", title: "Research files", note: "Papers and technical reports" },
  { key: "patent", title: "Patent files", note: "Published inventions, not ACE specifications" },
];

function SourceStatus({ item, available }) {
  return <span className={`text-[10px] font-semibold uppercase tracking-wider ${item.chatReady ? "text-moss-600" : "text-moss-800/55"}`}>
    {item.chatReady ? "Searchable in chat" : available ? "Further reading" : "Chat availability unverified"}
  </span>;
}

function Book({ item, index, available }) {
  return <li className="library-book" style={{ "--item-index": index }}>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-500">
      <span className="library-book-cover block min-h-36 p-3 text-white transition-transform group-hover:-translate-y-2">
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/65">Book · {item.year}</span>
        <span className="mt-5 block font-display text-sm font-semibold leading-tight">{item.title}</span>
        <span className="mt-2 block text-[10px] leading-tight text-white/70">{item.author}</span>
      </span>
      <span className="mt-2 block"><SourceStatus item={item} available={available} /></span>
    </a>
  </li>;
}

function File({ item, index, available }) {
  return <li className="library-file" style={{ "--item-index": index }}>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 border border-moss-200 bg-white p-3 shadow-[3px_4px_0_#dde9f2] transition hover:-translate-y-1 hover:shadow-[4px_6px_0_#bfd6e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-500">
      <span className="grid size-9 shrink-0 place-items-center bg-moss-50 text-moss-700"><Icon name={item.type === "patent" ? "cogs" : "book"} className="size-4" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-snug text-moss-950">{item.title}</span>
        <span className="mt-1 block text-xs text-moss-800/65">{item.author} · {item.year}</span>
        <SourceStatus item={item} available={available} />
      </span>
    </a>
  </li>;
}

export default function ResearchLibrary({ open, onClose, triggerRef }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (open) {
      if (!element.open) element.showModal();
      const frame = requestAnimationFrame(() => {
        element.classList.add("is-open");
        closeButton.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
    element.classList.remove("is-open");
    if (!element.open) return;
    const timer = setTimeout(() => {
      element.close();
      triggerRef.current?.focus();
    }, 280);
    return () => clearTimeout(timer);
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api.researchLibrary(controller.signal).then((data) => {
      setLibrary(data);
      setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open]);

  const available = library?.status === "ready";
  return <dialog ref={dialog} className="library-drawer" aria-label="Research library" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    <div className="flex h-full flex-col">
      <header className="border-b border-moss-200 bg-white px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss-600">Ask Ace · source shelf</p><h2 className="mt-1 font-display text-3xl font-semibold text-moss-950">The research library</h2></div>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close research library" className="rounded-full p-2 text-moss-800 hover:bg-moss-100"><Icon name="close" className="size-5" /></button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-moss-800/75">Explore the books, papers and patents behind the research chat. Open any source to read the original.</p>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {!library && !error && <p role="status" className="py-8 text-sm text-moss-800">Opening the shelves…</p>}
        {error && <p role="status" className="py-8 text-sm text-moss-800">The library is unavailable right now. Please try again later.</p>}
        {library?.status === "unavailable" && <p className="mt-5 border-l-2 border-moss-400 bg-moss-100 p-3 text-xs leading-relaxed text-moss-800">Source links are available. This preview cannot confirm which documents the chatbot has loaded.</p>}
        {library && TYPES.map(({ key, title, note }) => {
          const items = library.items.filter((item) => item.type === key);
          if (!items.length) return null;
          return <section key={key} className="mt-8" aria-labelledby={`library-${key}`}>
            <div className="mb-4"><h3 id={`library-${key}`} className="font-display text-xl font-semibold text-moss-950">{title}</h3><p className="text-xs text-moss-800/65">{note}</p></div>
            {key === "book" ? <ul className="library-bookshelf grid grid-cols-2 gap-3 border-b-8 border-moss-800 pb-2 sm:grid-cols-3">{items.map((item, index) => <Book key={item.id} item={item} index={index} available={available} />)}</ul>
              : <ul className="space-y-3">{items.map((item, index) => <File key={item.id} item={item} index={index} available={available} />)}</ul>}
          </section>;
        })}
      </div>
    </div>
  </dialog>;
}
