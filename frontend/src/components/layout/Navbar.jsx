// Floating frosted-glass pill nav that tucks up when you scroll; full-screen sheet on mobile.

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import Wordmark from "../brand/Wordmark.jsx";
import Button from "../ui/Button.jsx";
import Icon from "../ui/Icon.jsx";
import LiveBadge from "../live/LiveBadge.jsx";
import { NAV_LINKS } from "./navLinks.js";
import { gsap } from "../../lib/gsap.js";
import { scrollToTarget } from "../../hooks/useLenis.js";

function NavLink({ to, children, onNavigate, className = "" }) {
  const { pathname } = useLocation();
  const [path, hash] = to.split("#");
  const onClick = (e) => {
    onNavigate?.();
    if (hash && pathname === (path || "/")) {
      e.preventDefault();
      scrollToTarget(`#${hash}`);
    }
  };
  return (
    <Link to={to} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const sheet = useRef(null);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Arriving from another page with a #hash: scroll once the page has rendered.
  useEffect(() => {
    if (hash) setTimeout(() => scrollToTarget(hash), 700);
  }, [pathname, hash]);

  useEffect(() => {
    if (!sheet.current) return;
    if (open) gsap.fromTo(sheet.current.children, { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.5 });
  }, [open]);

  return (
    <header className="sticky top-0 z-50">
      <div className={`px-3 transition-[margin] duration-300 sm:px-4 ${scrolled ? "mt-2" : "mt-3 lg:mt-6"}`}>
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-[1096px] items-center rounded-full bg-gradient-to-br from-white/90 via-white/70 to-white/30 py-2 pl-3 pr-2 shadow-[inset_0_0.5px_0_0_rgb(239_250_245/0.6),0_34px_34px_0_rgb(10_21_29/0.03),0_9px_19px_0_rgb(10_21_29/0.05)] backdrop-blur-[40px] lg:py-3 lg:pl-5 lg:pr-3"
        >
          <div className="flex flex-1 items-center gap-3">
            <Wordmark markClassName="size-8 lg:size-9" textClassName="text-lg lg:text-xl" />
            <LiveBadge className="hidden xl:inline-flex" />
          </div>
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className="rounded-md px-3 py-2 text-sm font-medium text-moss-900/80 transition-colors hover:text-moss-950">
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Button to="/ask/community" size="sm" icon="commentDots" className="hidden sm:inline-flex">
              Ask Ace
            </Button>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full text-moss-900 hover:bg-moss-50 lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? "close" : "menu"} className="size-6" />
            </button>
          </div>
        </nav>
      </div>

      {open && (
        <div className="fixed inset-0 top-0 -z-10 bg-white/95 px-6 pt-28 backdrop-blur-xl lg:hidden">
          <ul ref={sheet} className="flex flex-col gap-2">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} onNavigate={() => setOpen(false)} className="block py-3 font-display text-3xl font-medium tracking-display text-moss-950">
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-4">
              <Button to="/ask/community" size="lg" icon="commentDots" onClick={() => setOpen(false)}>
                Ask Ace
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
