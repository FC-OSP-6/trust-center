/* ================================
  TL;DR  --> controls page section

  - react stays dumb  --> stencil fetches + groups + expands/collapses
  - passes only the status icon to reuse the same visual language
================================ */

import React from "react";
import statusCheckUrl from "../../assets/images/status-check.svg";


export default function Controls() {
  return (
    <section>
      <aon-subnav-card />

      {/* tile header values match the mock (title + optional meta + optional subtitle) */}
      <aon-control-card
        data-mode="controls"
        show-tile
        show-meta="false"
        // REVIEW: For custom elements, passing `"false"` (a string) as an attribute can still behave truthy; verify boolean prop handling or set via DOM property/ref.
        title-text=""
        subtitle-text=""
        // REVIEW: Empty-string props are redundant unless required to force behavior; prefer omitting them for cleaner markup.
        icon-src={statusCheckUrl}
      />

    </section>
  );
}
