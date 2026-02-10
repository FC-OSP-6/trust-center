/* ================================
  TL;DR  --> Resources section that shows the following:
      1. Client Facing Documents and External Links - In the format of a linked card
================================ */

import React from 'react';

export default function Resources() {
  return (
    <section>
      <aon-blue-card
        blue-card-title="Client Facing Documents"
        blue-card-button-link="https://cat-bounce.com/"
        blue-card-button-text="Visit Site"
        blue-card-description="Lorem ipsum dolor sit amet. ahkladhjk. ajshsn. ashjdlnj ajs dhsaw dwjkdlqndj idqjdiqd."
      />

    <link-card link-card-title="External Links"
      link-one-href="https://cat-bounce.com/"
      link-one-label="Security Innovations"
      link-two-href="https://cat-bounce.com/"
      link-two-label="Password Protection"
      link-three-href="https://cat-bounce.com/"
      link-three-label="Encryption"
    />

    </section>
  );
}
