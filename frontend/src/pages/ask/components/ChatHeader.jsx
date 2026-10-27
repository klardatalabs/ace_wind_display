import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { Link } from "react-router";

export default function ChatHeader({ title, screenName, screen, onReset, canReset }) {
  return (
    <header className="sticky top-0 z-20 border-b border-moss-100/70 bg-white/80 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <TurbineMark className="hidden size-11 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-semibold text-moss-950">{title}</p>
          <p className="truncate text-xs text-moss-900/60">Lawrence Weston wind · {screenName} screen</p>
        </div>
        <span className="hidden sm:block">
          <LiveBadge />
        </span>
        <Link to="/" aria-label="Home" className="rounded-full bg-moss-50 px-2 py-1.5 text-xs font-medium text-moss-800 ring-1 ring-moss-100 hover:bg-moss-100 sm:px-3"><Icon name="home" className="size-4 sm:hidden" /><span className="hidden sm:inline">Home</span></Link>
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-800 ring-1 ring-moss-100 transition hover:bg-moss-100 active:scale-95"
          >
            <Icon name="close" className="size-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        )}
        <Link to={`/screen/${screen}`} aria-label={`Close chat and return to ${screenName} screen`} className="rounded-full p-2 text-moss-800 hover:bg-moss-100 focus-visible:outline-2 focus-visible:outline-moss-700"><Icon name="close" className="size-5" /></Link>
      </div>
    </header>
  );
}
