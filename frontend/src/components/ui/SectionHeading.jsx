import Reveal from "./Reveal.jsx";

export default function SectionHeading({ eyebrow, title, children, className = "", align = "left" }) {
  return (
    <Reveal className={`flex flex-col gap-3 ${align === "center" ? "items-center text-center" : ""} ${className}`}>
      {eyebrow && <p className="text-sm font-medium text-moss-600">{eyebrow}</p>}
      <h2 className="max-w-[1000px] font-display text-4xl font-medium leading-[1.05] tracking-display text-moss-950 sm:text-5xl xl:text-[68px]">
        {title}
      </h2>
      {children && <p className="mt-2 max-w-[720px] text-lg text-moss-900/70">{children}</p>}
    </Reveal>
  );
}
