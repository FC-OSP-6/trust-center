/* ================================
  TL;DR  --> A button that when clicked expands to show the following:
      1. Client Facing Documents - linked cards
      2. Selected Controls - expansion cards
      3. Potentially also show the blue card as well
================================ */


import React from "react";
import statusCheckUrl from "../../assets/images/status-check.svg";


export default function Overview() {
  return (
    <section>
      <aon-link-card />
      <aon-link-card />

      {/* selected controls (stencil loads + groups internally) */}
      <aon-expansion-card
        data-mode="controls"
        group-limit="0"
        preview-limit="3"
        icon-variant="img"
        icon-src={statusCheckUrl}
        show-tile="true"
        tile-title="Selected Controls"
        show-meta="true"
        tile-subtitle=""
      />

      <aon-blue-card
        blue-card-title="Aon Trust Portal"
        blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts."
        blue-card-button-text="Visit Portal"
        blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome"
      />
    </section>
  );
}
