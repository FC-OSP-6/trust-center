/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  contains app routing, shell chrome visibility, and page mounting

      - derives known paths + route declarations from one route list (DRY)
      - passes prop-driven content into stencil layout components
      - uses shared nav/title/footer content from react bridge
      - normalizes active nav path to match trust-center-prefixed navbar hrefs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Overview from './components/sections/overview';
import Controls from './components/sections/controls';
import Resources from './components/sections/resources';
import Faqs from './components/sections/faqs';
import { navRows, titleCard, footCard } from './components/shared';
import logo from './assets/images/aon-logo.svg';

// ---------- route config ----------

type AppRoute = {
  path: string; // router path inside react app
  View: React.ComponentType; // page component mounted for this path
}; // route list drives route rendering + known-path checks

const routeList: AppRoute[] = [
  { path: '/overview', View: Overview }, // overview page route
  { path: '/controls', View: Controls }, // controls page route
  { path: '/resources', View: Resources }, // resources page route
  { path: '/faqs', View: Faqs } // faqs page route
]; // add/edit page routes here to keep checks + rendering in sync

const pathSet = new Set(routeList.map(route => route.path)); // set lookup avoids repeated array scans

// ---------- shared navbar payload ----------

const navJson = JSON.stringify(navRows); // stencil navbar parses json string prop

// ---------- path helpers ----------

function withBase(path: string) {
  const raw = (path ?? '').trim(); // normalize unknown/empty path input

  if (!raw || raw === '/') return '/trust-center'; // root maps to app base for active-path consistency

  if (raw.startsWith('/trust-center')) return raw; // already prefixed, keep as-is

  return `/trust-center${raw}`; // prefix react-router path to match navbar href values
}

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
  const pathNow = location.pathname; // explicit route path for checks + prop mapping

  const showShell = pathSet.has(pathNow); // chrome renders only on known trust-center pages

  const navPath = withBase(pathNow); // matches shared nav hrefs (which include /trust-center prefix)

  return (
    <>
      {showShell && (
        <header className="trust-center-chrome">
          <aon-header />

          <aon-title
            trust-center-name={titleCard.name}
            support-message={titleCard.text}
            support-email={titleCard.email}
            support-email-subject={titleCard.mailSubj}
          />

          <aon-navbar
            items-json={navJson}
            active-path={navPath}
            nav-aria-label="Trust Center sections"
          />
        </header>
      )}{' '}
      {/* semantic wrapper adds a minimal styling hook without a generic container */}
      <main className="trust-center-main">
        <Routes>
          {/* default entry route */}
          <Route path="/" element={<Navigate to="/overview" replace />} />

          {/* renders page routes from shared config to keep declarations DRY */}
          {routeList.map(({ path, View }) => (
            <Route key={path} path={path} element={<View />} />
          ))}

          {/* shared fallback replaces inline div */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {showShell && (
        <footer className="trust-center-footer">
          <aon-footer
            logo-src={logo}
            logo-alt="Aon logo"
            copyright={footCard.copy}
            privacy-policy-href={footCard.privacyHref}
            privacy-policy-label={footCard.privacyLabel}
            terms-href={footCard.termsHref}
            terms-label={footCard.termsLabel}
          />
        </footer>
      )}{' '}
    </>
  );
}
