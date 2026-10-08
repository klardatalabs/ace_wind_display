import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import SiteLayout from "./components/layout/SiteLayout.jsx";
import LandingPage from "./pages/landing/LandingPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// Heavy, full-screen experiences load on demand so the website stays light.
const DevelopersPage = lazy(() => import("./pages/developers/DevelopersPage.jsx"));
const ScreenPage = lazy(() => import("./pages/screens/ScreenPage.jsx"));
const AskPage = lazy(() => import("./pages/ask/AskPage.jsx"));
const SiteViewerPage = lazy(() => import("./pages/site/SiteViewerPage.jsx"));

const lazyPage = (Page) => (
  <Suspense fallback={<div className="min-h-dvh bg-white" />}>
    <Page />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/developers", element: lazyPage(DevelopersPage) },
      { path: "/site", element: lazyPage(SiteViewerPage) },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  // Kiosk + phone experiences have no site chrome.
  { path: "/screen/:screen", element: lazyPage(ScreenPage) },
  { path: "/ask/:screen?", element: lazyPage(AskPage) },
]);
