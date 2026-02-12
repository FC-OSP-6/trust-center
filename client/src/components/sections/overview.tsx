/* ================================
  TL;DR  --> A button that when clicked expands to show the following:
      1. Client Facing Documents - linked cards
      2. Selected Controls - expansion cards
      3. Potentially also show the blue card as well
================================ */
import React from "react";

export default function Overview() {
  return (
    <section>
      <aon-link-card />
      <aon-link-card />
      <aon-expansion-card />
      <aon-expansion-card />
      <aon-expansion-card />
      <aon-blue-card blue-card-title="Aon Trust Portal" blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts." blue-card-button-text="Visit Portal" blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome" />
    </section>
  );
}