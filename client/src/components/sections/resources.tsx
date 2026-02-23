/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  resources page section

  - react passes shared resource rows into stencil wrappers
  - wrappers stay generic and stencil owns rendering
  - no hidden defaults in the bridge layer
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';
import {
  ResourceCards,
  PortalCallout,
  docRows,
  extRows,
  portalCard
} from '../shared';

export default function Resources() {
  return (
    <section className="resources-section">
      <ResourceCards
        docTitle="Documents"
        extTitle="External Links"
        docRows={docRows}
        extRows={extRows}
      />

      <PortalCallout
        title={portalCard.title}
        text={portalCard.text}
        btnText={portalCard.btnText}
        btnLink={portalCard.btnLink}
      />
    </section>
  );
}
