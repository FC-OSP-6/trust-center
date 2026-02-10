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
      <aon-blue-card />
    </section>
  );
}