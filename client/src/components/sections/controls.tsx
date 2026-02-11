/* ================================
  TL;DR  --> A button that when clicked expands to show the following subsections: 
      1. Infrastructure Security
      2. Organizational Security
      3. Product Security
      4. Internal Security Procedures
      5. Data and Privacy
================================ */
import React from 'react';

export default function Controls() {
  return (
    <section>
      <aon-subnav-card />
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
    </section>
  );
}
