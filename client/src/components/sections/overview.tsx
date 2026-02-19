/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> overview page section (react stays dumb)

  layout intent (per mockups):
  1) link cards  --> client facing documents + external links
  2) "Aon Trust Portal" blue card  --> between resources + selected controls
  3) selected controls  --> stencil fetches + groups from graphql (db-first, json fallback happens server-side)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react';

/* icon assets  --> used by link cards */
import PDF from '../../assets/images/pdf-svgrepo-com.svg';
import External from '../../assets/images/external-link-svgrepo-com.svg';

/* pdf assets  --> bundled static files */
import ClientPrivacySummaryPDF from '../../assets/PDFs/Aon Client Privacy Summary - Mock.pdf';
import PenetrationTestsPDF from '../../assets/PDFs/CyQuPenetrationTestReports.pdf';
import PrivacyPolicyPDF from '../../assets/PDFs/CyQuPrivacyPolicy.pdf';
import CyberSecurityRiskManagement from '../../assets/PDFs/Aon Cyber Security and Risk Management Overview - Mock.pdf';

/* bullet icon for selected controls  --> passed into stencil expansion list */
import statusCheckUrl from '../../assets/images/status-check.svg';

export default function Overview() {
  return (
    /* section container  --> uses global layout primitives in client/src/styles.css */
    <section className="overview-section">
      {/* ---------------- resources (link cards) ---------------- */}
      <div className="resources-grid">
        {/* link card  --> client facing documents */}
        {/* TODO: Multiple empty placeholder cards create duplication/noise; consider rendering from typed data arrays and mapping for DRY composition. */}
        <aon-link-card
          link-title="Client Facing Documents"
          items={JSON.stringify([
            {
              label: 'CyQu Privacy Policy',
              href: PrivacyPolicyPDF,
              iconSrc: PDF,
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

        {/* link card  --> external links */}
        <aon-link-card
          link-title="External Links"
          items={JSON.stringify([
            {
              label: 'Aon: Ensuring Ongoing Operations',
              href: 'https://www.aon.com/en/capabilities/risk-management/business-continuity-management',
              iconSrc: External,
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

      {/* ---------------- aon trust portal (blue card) ---------------- */}
      <div className="resources-callout">
        <aon-blue-card
          blue-card-title="Aon Trust Portal"
          blue-card-description="Direct access to widely consumed Aon enterprise controls and artifacts."
          blue-card-button-text="Visit"
          blue-card-button-link="https://aonmt.tbs.aon.com/login?returnUrl=%2Fhome"
        />
      </div>

      {/* ---------------- selected controls (db-driven via graphql) ---------------- */}
      <div className="overview-selected-controls">
        {/* stencil owns: fetch + grouping + per-card view all + +n more */}
        <aon-expansion-card
          data-mode="controls"
          show-tile={true}
          tile-title="Selected Controls"
          show-meta={true}
          tile-subtitle=""
          preview-limit={3}
          category-limit={3}
          fetch-first={50}
          icon-src={statusCheckUrl}
        />
      </div>
    </section>
  );
}
