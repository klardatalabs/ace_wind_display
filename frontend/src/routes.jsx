import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import SiteLayout from "./components/layout/SiteLayout.jsx";
import LandingPage from "./pages/landing/LandingPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// Heavy, full-screen experiences load on demand so the website stays light.
const DevelopersPage = lazy(() => import("./pages/developers/DevelopersPage.jsx"));
const ScreenPage = lazy(() => import("./pages/screens/ScreenPage.jsx"));
const AskPage = lazy(() => import("./pages/ask/AskPage.jsx"));
const LiveExplorerPage = lazy(() => import("./pages/screens/LiveExplorerPage.jsx"));

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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  // Kiosk + phone experiences have no site chrome.
  { path: "/site", element: <Navigate to="/screen/live" replace /> },
  { path: "/screen/live", element: lazyPage(LiveExplorerPage) },
  { path: "/screen/college/news", element: <Navigate to="/screen/community" replace /> },
  { path: "/screen/:screen", element: lazyPage(ScreenPage) },
  { path: "/ask/:screen?", element: lazyPage(AskPage) },
]);
