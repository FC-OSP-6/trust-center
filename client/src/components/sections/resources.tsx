/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  resources page section (react thin + stencil-presented shared ui)

  - react stays dumb and imports thin shared wrappers
  - shared wrappers pass json into stencil components
  - portal callout + resource lists render consistently across pages
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react'; // react jsx runtime for page section
import { ResourceCards, PortalCallout } from '../shared'; // thin wrappers around stencil components

export default function Resources() {
  return (
    <section className="resources-section">
      <ResourceCards />
      <PortalCallout buttonText="Visit" />
    </section>
  );
}
