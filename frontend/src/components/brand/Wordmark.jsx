import { Link } from "react-router";
import TurbineMark from "./TurbineMark.jsx";

export default function Wordmark({ className = "", markClassName = "size-9", textClassName = "text-xl" }) {
  return (
    <Link to="/" aria-label="Weston Wind home" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <TurbineMark className={markClassName} />
      <span className={`whitespace-nowrap font-display font-bold tracking-display text-moss-950 ${textClassName}`}>
        Weston<span className="text-moss-500"> Wind</span>
      </span>
    </Link>
  );
}
