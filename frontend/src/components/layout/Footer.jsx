import { Link } from "react-router";
import Wordmark from "../brand/Wordmark.jsx";
import { NAV_LINKS, SCREEN_LINKS } from "./navLinks.js";
import { ATTRIBUTION_TEXT, LICENSE_URL } from "../../lib/impact.js";

const RESOURCES = [
  { label: "Ambition Community Energy", href: "https://ambitioncommunityenergy.org/" },
  { label: "Ambition Lawrence Weston", href: "https://www.ambitionlw.org/" },
  { label: "ACE Live API", href: "https://ace-api.duckdns.org/docs" },
  { label: "Open data on Zenodo", href: "https://doi.org/10.5281/zenodo.22662372" },
];

function Column({ title, children }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-medium tracking-widest text-moss-600 uppercase">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

const linkCls = "text-moss-900/80 underline-offset-4 transition-colors hover:text-moss-950 hover:underline";

export default function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden rounded-t-4xl bg-white px-6 pb-12 md:px-12 xl:px-24">
      <div className="sky-wash sky-wash-up pointer-events-none absolute inset-x-0 bottom-0 hidden h-96 lg:block" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1280px] pt-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <Wordmark />
            <p className="max-w-xs text-sm text-moss-900/70">
              The community-owned wind turbine in Lawrence Weston, Bristol — live, explained, and ready to answer your questions.
            </p>
          </div>
          <Column title="Explore">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </Column>
          <Column title="Screens">
            {SCREEN_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </Column>
          <Column title="Resources">
            {RESOURCES.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className={linkCls}>
                  {l.label}
                </a>
              </li>
            ))}
          </Column>
        </div>

        <p
          className="pointer-events-none mt-20 select-none font-display text-[18vw] leading-none font-black tracking-tighter text-moss-100 xl:text-[220px]"
          aria-hidden="true"
        >
          Weston Wind
        </p>

        <div className="mt-6 flex flex-col gap-3 border-t border-moss-100 pt-6 text-xs text-moss-900/60 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">
            Turbine data © ACE, published under{" "}
            <a href={LICENSE_URL} className="underline" target="_blank" rel="noreferrer">
              CC-BY-4.0
            </a>
            . {ATTRIBUTION_TEXT}
          </p>
          <p>
            Icons by{" "}
            <a href="https://icons8.com/line-awesome" className="underline" target="_blank" rel="noreferrer">
              Icons8
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
