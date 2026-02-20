/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> faqs page section

  - react stays dumb  --> stencil fetches + groups + expands/collapses
  - pass real booleans (not "false" strings) for stencil boolean props
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';

export default function Faqs() {
  return (
    <section>
      <aon-subnav-card />

      <aon-faq-card data-mode="faqs" show-tile={true} show-meta={false} />
    </section>
  );
}
