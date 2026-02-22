/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  contains app routing, shell chrome visibility, and page mounting

      - derives known paths and route declarations from one shared config (DRY)
      - keeps header/navbar/footer hidden for unknown routes
      - uses a small shared not found component (no inline fallback div)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Overview from './components/sections/overview';
import Controls from './components/sections/controls';
import Resources from './components/sections/resources';
import Faqs from './components/sections/faqs';
import logo from './assets/images/aon-logo.svg';

// ---------- route config ----------

type AppSectionRoute = {
  path: string;
  Component: React.ComponentType;
}; // keeps route declarations and known path checks driven from one source

const appSectionRoutes: AppSectionRoute[] = [
  { path: '/overview', Component: Overview }, // overview page route
  { path: '/controls', Component: Controls }, // controls page route
  { path: '/resources', Component: Resources }, // resources page route
  { path: '/faqs', Component: Faqs } // faqs page route
]; // add/edit page routes here so path checks and route rendering stay in sync

const knownSectionPaths = new Set(appSectionRoutes.map(route => route.path)); // set lookup avoids repeated array includes checks

// ---------- not found view ----------

function NotFoundPage() {
  return (
    <article
      className="trust-center-not-found"
      aria-labelledby="trust-center-not-found-title"
    >
      <h1 id="trust-center-not-found-title">Not Found</h1>
      <p className="trust-center-not-found-copy">
        The page you requested does not exist.
      </p>
    </article>
  ); // shared fallback improves reuse/styling/testability vs inline div
}

// ---------- app shell ----------

export default function App() {
  const location = useLocation(); // reads current client route from react-router
  const path = location.pathname; // keeps route comparison explicit and easy to debug

  const isKnownPath = knownSectionPaths.has(path); // chrome only renders for our main app sections

  return (
    <>
      {isKnownPath && (
        <header className="trust-center-chrome">
          <aon-header />
          <aon-title />
          <aon-navbar />
        </header>
      )}{' '}
      {/* semantic wrapper adds a minimal styling hook without a generic container */}
      <main className="trust-center-main">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />{' '}
          {/* default entry route */}
          {appSectionRoutes.map(({ path: routePath, Component }) => (
            <Route key={routePath} path={routePath} element={<Component />} />
          ))}{' '}
          {/* renders page routes from shared config to keep declarations DRY */}
          <Route path="*" element={<NotFoundPage />} />{' '}
          {/* shared fallback replaces inline div */}
        </Routes>
      </main>
      {isKnownPath && (
        <footer className="trust-center-footer">
          <aon-footer logo-src={logo} />
        </footer>
      )}{' '}
      {/* semantic wrapper adds a minimal styling hook without a generic container */}
    </>
  );
}
