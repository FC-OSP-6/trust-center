/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  thin react bridge for shared resource ui (stencil owns rendering)

  - keeps react "dumb" by only preparing static data + json strings
  - delegates resource card rendering to <aon-link-card>
  - delegates portal callout rendering to <aon-blue-card>
  - preserves compatibility exports: ResourceCards + ResourceLinkCards + PortalCallout
  - omits optional link-card extras for wireframe parity (subtitle/chip/cta/description)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React from 'react'; // react jsx runtime for thin wrapper components
import PDF from '../assets/images/pdf-svgrepo-com.svg'; // bundled icon url for pdf items
import External from '../assets/images/external-link-svgrepo-com.svg'; // bundled icon url for external items
import ClientPrivacySummaryPDF from '../assets/PDFs/Aon Client Privacy Summary - Mock.pdf'; // bundled mock pdf
import PenetrationTestsPDF from '../assets/PDFs/CyQuPenetrationTestReports.pdf'; // bundled mock pdf
import PrivacyPolicyPDF from '../assets/PDFs/CyQuPrivacyPolicy.pdf'; // bundled mock pdf
import CyberSecurityRiskManagement from '../assets/PDFs/Aon Cyber Security and Risk Management Overview - Mock.pdf'; // bundled mock pdf

// ----------  shared resource item shape passed into stencil as json  ----------

type ResourceLinkItem = {
  label: string; // display title for the row / link
  href: string; // bundled asset url or external url
  iconSrc?: string; // icon url passed to stencil so stencil can render image inside shadow dom
  iconAlt?: string; // optional alt text for decorative / non-decorative icon use

  // optional richer fields supported by stencil (intentionally omitted in this page's payload)
  kind?: 'pdf' | 'external'; // optional kind (would render chip if provided)
  description?: string; // optional supporting text shown below the label
  ctaLabel?: string; // optional trailing cta label
}; // json-safe shape consumed by aon-link-card

// ----------  static data (react owns urls, stencil owns presentation)  ----------

const DOCUMENT_RESOURCES: ResourceLinkItem[] = [
  {
    label: 'Aon Client Privacy Summary (Mock)',
    href: ClientPrivacySummaryPDF,
    iconSrc: PDF,
    iconAlt: ''
  },
  {
    label: 'CyQu Penetration Test Reports',
    href: PenetrationTestsPDF,
    iconSrc: PDF,
    iconAlt: ''
  },
  {
    label: 'CyQu Privacy Policy',
    href: PrivacyPolicyPDF,
    iconSrc: PDF,
    iconAlt: ''
  },
  {
    label: 'Aon Cyber Security and Risk Management Overview (Mock)',
    href: CyberSecurityRiskManagement,
    iconSrc: PDF,
    iconAlt: ''
  }
]; // bundled docs stay in client because vite resolves these imports here

const EXTERNAL_RESOURCES: ResourceLinkItem[] = [
  {
    label: 'Aon Corporate Website',
    href: 'https://www.aon.com/',
    iconSrc: External,
    iconAlt: ''
  },
  {
    label: 'Aon Investor Relations',
    href: 'https://investors.aon.com/',
    iconSrc: External,
    iconAlt: ''
  },
  {
    label: 'Aon Newsroom',
    href: 'https://www.aon.com/en/about/newsroom',
    iconSrc: External,
    iconAlt: ''
  }
]; // external links kept as plain json-friendly objects

// ----------  pre-serialized json (avoids repeat stringify during renders)  ----------

const DOCUMENT_RESOURCES_JSON = JSON.stringify(DOCUMENT_RESOURCES); // parsed inside stencil component
const EXTERNAL_RESOURCES_JSON = JSON.stringify(EXTERNAL_RESOURCES); // parsed inside stencil component

// ----------  optional wrapper props  ----------

type PortalCalloutProps = {
  buttonText?: string; // compatibility with older callers passing buttonText
  buttonLink?: string; // optional override for portal destination
  title?: string; // optional override for displayed title
  description?: string; // optional override for displayed description
}; // thin prop surface so callers can customize without owning layout

// ----------  shared exports (thin react wrappers around stencil)  ----------

export function ResourceLinkCards() {
  return (
    <div className="resource-link-cards">
      <aon-link-card link-title="Documents" items={DOCUMENT_RESOURCES_JSON} />

      <aon-link-card
        link-title="External Links"
        items={EXTERNAL_RESOURCES_JSON}
      />
    </div>
  );
} // primary resource section wrapper (react bridge only)

export const ResourceCards = ResourceLinkCards; // compatibility alias for older imports

export function PortalCallout({
  buttonText = 'Visit Portal',
  buttonLink = 'https://www.aon.com/',
  title = 'Aon Trust Portal',
  description = 'Visit the main portal for shared trust, risk, and security materials intended for partners and customers.'
}: PortalCalloutProps) {
  return (
    <div className="portal-callout">
      <aon-blue-card
        blue-card-title={title}
        blue-card-description={description}
        blue-card-button-text={buttonText}
        blue-card-button-link={buttonLink}
      />
    </div>
  );
} // compatibility wrapper so callers do not need to know stencil prop names
