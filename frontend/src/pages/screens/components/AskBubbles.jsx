// Questions children might ask Ace, popping up one by one beside it in the "Ask me"
// chapter, so a visitor knows what the QR code is for. Each one is something the chat can
// answer from the live data or its books.

const QUESTIONS = ["How fast are your blades going?", "What happens in a storm?", "Who owns you?", "How does wind make electricity?"];

export default function AskBubbles() {
  return (
    <ul className="pointer-events-none absolute top-[24vh] left-[3vmin] z-10 flex flex-col items-start gap-[2vmin] portrait:hidden" aria-label="Things you could ask">
      {QUESTIONS.map((q, i) => (
        <li
          key={q}
          className="milestone-in rounded-[2.4vmin] rounded-bl-[0.6vmin] bg-white px-[2.4vmin] py-[1.4vmin] text-[clamp(13px,2.2vmin,44px)] font-medium text-moss-900 shadow-[0_10px_30px_rgb(10_21_29/0.18)] ring-1 ring-moss-100"
          style={{ animationDelay: `${0.8 + i * 1.6}s`, marginLeft: `${(i % 2) * 4}vmin` }}
        >
          {q}
        </li>
      ))}
    </ul>
  );
}
