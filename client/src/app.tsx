/* ================================
  TL;DR  -->  contains all state function and components

      - logic for flipping between sections
      - button logic for each component
================================ */

import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Overview from './components/sections/overview';
import Controls from './components/sections/controls';
import Resources from './components/sections/resources';
import Faqs from './components/sections/faqs';

export default function App() {
  const location = useLocation();
  const path = location.pathname;

  const knownPaths = ['/overview', '/controls', '/resources', '/faqs'];
  const isKnownPath = knownPaths.includes(path);

  return (
    <div className="trust-center-app">
      {isKnownPath && <aon-navbar />}

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/faqs" element={<Faqs />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </main>

      {isKnownPath && <aon-footer />}
    </div>
  );
}
