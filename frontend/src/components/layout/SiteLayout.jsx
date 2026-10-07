import { Outlet } from "react-router";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import PageTransition from "./PageTransition.jsx";
import { useLenis } from "../../hooks/useLenis.js";

export default function SiteLayout() {
  useLenis();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="sky-wash pointer-events-none absolute inset-x-0 top-0 hidden h-56 lg:block" aria-hidden="true" />
      <Navbar />
      <main className="relative flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}
