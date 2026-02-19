/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Resources Section Composition Component

   - Composes Trust Center resource content using web components.
   - Supplies structured link data to <aon-link-card> via JSON-stringified props.
   - Groups resources into internal documents and external links.
   - Includes promotional callout via <aon-blue-card>.
   - Relies on asset imports for PDFs and icons bundled by the build system.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';

/* Icon assets: used to visually distinguish file types */
import PDF from '../../assets/images/pdf-svgrepo-com.svg';
import External from '../../assets/images/external-link-svgrepo-com.svg';

/* PDF document assets: bundled and served as static files */
import ClientPrivacySummaryPDF from '../../assets/PDFs/Aon Client Privacy Summary - Mock.pdf';
import PenetrationTestsPDF from '../../assets/PDFs/CyQuPenetrationTestReports.pdf';
import PrivacyPolicyPDF from '../../assets/PDFs/CyQuPrivacyPolicy.pdf';
import CyberSecurityRiskManagement from '../../assets/PDFs/Aon Cyber Security and Risk Management Overview - Mock.pdf';

/**
 * Resources
 *
 * Layout-level React component responsible for:
 * - Structuring resource categories
 * - Providing link metadata to presentation components
 * - Coordinating placement of link cards and callout card
 *
 * Contains no state or side effects; purely declarative composition.
 */
export default function Resources() {
  return (
    /* Section container: defines semantic grouping for resources */
    <section className="resources-section">
      {/* Grid container: controls layout of link cards (handled via external CSS) */}
      <div className="resources-grid">
        {/* Link Card: Internal / downloadable documents */}
        <aon-link-card
          link-title="Client Facing Documents"
          items={JSON.stringify([
            // REVIEW: Inline JSON.stringify payloads re-allocate every render; extract typed `const` arrays (outside component) and stringify once for DRY/perf.
            {
              label: 'CyQu Privacy Policy',
              href: PrivacyPolicyPDF, // Local static PDF asset
              iconSrc: PDF, // Indicates downloadable file
              iconAlt: 'PDF file'
            },
            {
              label: 'CyQu Penetration Test Reports',
              href: PenetrationTestsPDF,
              iconSrc: PDF,
              iconAlt: 'PDF file'
            },
            {
              label: 'Aon: Client Privacy Summary',
              href: ClientPrivacySummaryPDF,
              iconSrc: PDF,
              iconAlt: 'PDF file'
            },
            {
              label: 'Aon: Cyber Security and Risk Management Overview',
              href: CyberSecurityRiskManagement,
              iconSrc: PDF,
              iconAlt: 'PDF file'
            }
          ])}
        />

        {/* Link Card: External enterprise resources */}
        <aon-link-card
          link-title="External Links"
          items={JSON.stringify([
            // REVIEW: This block duplicates the same shape as above; consider a shared `toLinkCardItems(...)` helper + typed constants.
            {
              label: 'Aon: Ensuring Ongoing Operations',
              href: 'https://www.aon.com/en/capabilities/risk-management/business-continuity-management',
              iconSrc: External, // Indicates outbound navigation
              iconAlt: 'External link'
            },
            {
              label: 'Aon Secure',
              href: 'https://www.aon.com/en/capabilities/cyber-resilience',
              iconSrc: External,
              iconAlt: 'External link'
            },
            {
              label: 'Aon’s Policies and Standards',
              href: 'https://www.aon.com/en/about/leadership-and-governance/code-of-business-conduct',
              iconSrc: External,
              iconAlt: 'External link'
            },
            {
              label: 'Aon: Security - Submit Request',
              href: 'https://www.aon.com/en/about/leadership-and-governance/report-an-emergency',
              iconSrc: External,
              iconAlt: 'External link'
            }
          ])}
        />
      </div>

      {/* Callout container: visually separated promotional/portal access block */}
      <div className="resources-callout">
        <aon-blue-card
          blue-card-title="Aon Trust Portal"
          blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts."
          blue-card-button-text="Visit Portal"
          blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome"
        />
      </div>
    </section>
  );
}
