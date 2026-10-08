// Primary: dark green gradient with a shimmer sweep and rotating glow on hover.
// Secondary: frosted glass with a hairline ring. Both press-scale on click.

import { Link } from "react-router";
import Icon from "./Icon.jsx";

const base =
  "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-medium whitespace-nowrap transition-all duration-300 ease-out active:scale-[0.97] select-none";

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

const variants = {
  primary:
    "bg-gradient-to-b from-moss-800 to-moss-950 text-white shadow-[inset_0_2px_0_0_rgb(255_255_255/0.14)] hover:from-moss-700 hover:to-moss-900",
  secondary:
    "bg-white/60 text-moss-900 ring-1 ring-moss-200 backdrop-blur-sm shadow-[0_2px_8px_rgb(10_21_29/0.05)] hover:bg-white/90 hover:ring-moss-300 hover:shadow-[0_4px_16px_rgb(10_21_29/0.09)]",
  glass: "bg-white/15 text-white ring-1 ring-white/35 backdrop-blur-md hover:bg-white/25 glass-ring",
};

export default function Button({ to, href, variant = "primary", size = "md", icon, iconLeft, children, className = "", ...rest }) {
  const content = (
    <>
      {variant === "primary" && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 ease-out group-hover/btn:translate-x-full" />
      )}
      {iconLeft && <Icon name={iconLeft} className="relative size-[18px]" />}
      <span className="relative">{children}</span>
      {icon && <Icon name={icon} className="relative size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />}
    </>
  );
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  const inner = to ? (
    <Link to={to} className={cls} {...rest}>
      {content}
    </Link>
  ) : href ? (
    <a href={href} className={cls} {...rest}>
      {content}
    </a>
  ) : (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  );

  if (variant !== "primary") return <span className="group/btn inline-flex">{inner}</span>;
  return (
    <span className="group/btn relative inline-flex">
      <span className="cta-glow pointer-events-none absolute -inset-1 -z-10 rounded-xl opacity-0 blur-md transition-opacity duration-500 group-hover/btn:opacity-80" />
      <span className="cta-glow pointer-events-none absolute -inset-px -z-10 rounded-xl opacity-50 transition-opacity duration-300 group-hover/btn:opacity-90" />
      {inner}
    </span>
  );
}
