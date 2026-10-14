// Primary: solid dark ink. Secondary: white with a hairline ring. Glass: for use on photos.

import { Link } from "react-router";
import Icon from "./Icon.jsx";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors duration-200 select-none";

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-[15px]",
  lg: "px-7 py-3.5 text-base",
};

const variants = {
  primary: "bg-moss-900 text-white hover:bg-moss-800",
  secondary: "bg-white text-moss-900 ring-1 ring-moss-200 hover:bg-moss-25 hover:ring-moss-300",
  glass: "bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md hover:bg-white/25",
};

export default function Button({ to, href, variant = "primary", size = "md", icon, iconLeft, children, className = "", ...rest }) {
  const content = (
    <>
      {iconLeft && <Icon name={iconLeft} className="size-[18px]" />}
      <span>{children}</span>
      {icon && <Icon name={icon} className="size-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" />}
    </>
  );
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {content}
    </button>
  );
}
