/* ================================
  TL;DR  --> Resources section that shows the following:
      1. Client Facing Documents and External Links - In the format of a linked card
================================ */

import React from 'react';

export default function Resources() {
  return (
    <section>
      <aon-link-card />
      <aon-link-card
        link-card-title="Client Facing Documents"
        link-one-label="CyQu Privacy Policy"
        link-one-href="https://www.aon.com/getmedia/a9d04647-b790-43c3-b0ec-b185ec29b23a/practice-tasks-verbal-reasoning.pdf"
        link-two-label="Aon: Client Privacy Summary"
        link-two-href="https://www.aon.com/getmedia/a9d04647-b790-43c3-b0ec-b185ec29b23a/practice-tasks-verbal-reasoning.pdf"
        link-three-label="Aon: Cyber Security and Risk Management Overview"
        link-three-href="https://www.aon.com/getmedia/a9d04647-b790-43c3-b0ec-b185ec29b23a/practice-tasks-verbal-reasoning.pdf"
        link-four-label="Aon: Ensuring Ongoing Operations"
        link-four-href="https://www.aon.com/getmedia/a9d04647-b790-43c3-b0ec-b185ec29b23a/practice-tasks-verbal-reasoning.pdf"
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
