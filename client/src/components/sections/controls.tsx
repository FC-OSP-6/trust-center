/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> controls page section

  - react stays dumb  --> stencil fetches + groups + expands/collapses
  - passes only the status icon to reuse the same visual language
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from "react";
import statusCheckUrl from "../../assets/images/status-check.svg";

export default function Controls() {
  return (
    <section>
      <aon-subnav-card />

      <aon-control-card
        data-mode="controls"
        show-tile={true}
        show-meta={false}
        title-text=""
        subtitle-text=""
        icon-src={statusCheckUrl}
      />
    </section>
  );
}
