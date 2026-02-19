/* ================================
  TL;DR  --> A button that when clicked expands to show the following:
      1. Client Facing Documents - linked cards
      2. Selected Controls - expansion cards
      3. Potentially also show the blue card as well
================================ */

import React from 'react';
import statusCheckUrl from '../../assets/images/status-check.svg';
// REVIEW: `statusCheckUrl` is imported but unused; remove dead imports to keep lint/type signals clean.

export default function Overview() {
  return (
    <section>
      {/* REVIEW: Multiple empty placeholder cards create duplication/noise; consider rendering from typed data arrays and mapping for DRY composition. */}
      <aon-link-card />
      <aon-link-card />
      <aon-expansion-card />
      <aon-expansion-card />
      <aon-expansion-card />
      <aon-blue-card
        blue-card-title="Aon Trust Portal"
        blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts."
        blue-card-button-text="Visit Portal"
        blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome"
      />
    </section>
  );
}
