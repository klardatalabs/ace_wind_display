import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import Icon from "../../../components/ui/Icon.jsx";

export default function ChatHeader({ title, screenName, onReset, canReset }) {
  return (
    <header className="sticky top-0 z-20 border-b border-moss-100/70 bg-white/80 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <TurbineMark className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-semibold text-moss-950">{title}</p>
          <p className="truncate text-xs text-moss-900/60">Weston Wind · {screenName} screen</p>
        </div>
        <span className="hidden sm:block">
          <LiveBadge />
        </span>
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-800 ring-1 ring-moss-100 transition hover:bg-moss-100 active:scale-95"
          >
            <Icon name="close" className="size-3.5" />
            New chat
          </button>
        )}
      </div>
    </header>
  );
}
