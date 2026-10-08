export default function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Ace is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot size-2 rounded-full bg-moss-400" style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  );
}
