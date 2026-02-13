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
        linkCardTitle=""
        linkOneLabel=""
        linkOneHref=""
        linkTwoLabel=""
        linkTwoHref=""
        linkThreeLabel=""
        linkThreeHref=""
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
