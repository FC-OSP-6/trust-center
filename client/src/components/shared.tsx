/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  thin react bridge + react-owned trust center content

  - react owns business copy, urls, and static resource lists
  - stencil owns rendering behavior and visual presentation
  - wrappers only map props and serialize json for stencil
  - no backwards-compat aliases or hidden defaults
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useMemo } from 'react'; // react jsx runtime + memo for stable json props
import PDF from '../assets/images/pdf-svgrepo-com.svg'; // bundled icon url for pdf rows
import External from '../assets/images/external-link-svgrepo-com.svg'; // bundled icon url for external rows
import ClientPrivacySummaryPDF from '../assets/PDFs/Aon Client Privacy Summary - Mock.pdf'; // bundled mock pdf
import PenetrationTestsPDF from '../assets/PDFs/CyQuPenetrationTestReports.pdf'; // bundled mock pdf
import PrivacyPolicyPDF from '../assets/PDFs/CyQuPrivacyPolicy.pdf'; // bundled mock pdf
import CyberSecurityRiskManagement from '../assets/PDFs/Aon Cyber Security and Risk Management Overview - Mock.pdf'; // bundled mock pdf

// ----------  local ui types  ----------

export type LinkRow = {
  label: string; // visible row label
  href: string; // local pdf url or external url
  iconSrc?: string; // optional icon url
  iconAlt?: string; // optional icon alt text
};

type ResourceProps = {
  docTitle: string; // first card title
  extTitle: string; // second card title
  docRows: LinkRow[]; // document list
  extRows: LinkRow[]; // external list
};

type PortalProps = {
  title: string; // blue card title
  text: string; // blue card description
  btnText: string; // button label
  btnLink: string; // button href
};

// ----------  react-owned shared content  ----------

export const navRows = [
  {
    label: 'OVERVIEW',
    href: '/trust-center/overview',
    match: 'exact' as const
  },
  {
    label: 'CONTROLS',
    href: '/trust-center/controls',
    match: 'prefix' as const
  },
  {
    label: 'RESOURCES',
    href: '/trust-center/resources',
    match: 'prefix' as const
  },
  { label: 'FAQ', href: '/trust-center/faqs', match: 'prefix' as const }
]; // navbar rows passed into <aon-navbar>

export const titleCard = {
  name: 'Trust Center',
  text: 'Resources to address common cyber security questions from clients.',
  email: 'cyber.security.support@email.com',
  mailSubj: 'Trust-Center-Support'
}; // title props passed into <aon-title>

export const footCard = {
  copy: 'Copyright 2026 AON PLC',
  privacyHref: '/privacy-policy',
  privacyLabel: 'Privacy Policy',
  termsHref: '/terms-and-conditions',
  termsLabel: 'Terms and Conditions'
}; // footer props passed into <aon-footer>

export const portalCard = {
  title: 'Aon Trust Portal',
  text: 'Visit the main portal for shared trust, risk, and security materials intended for partners and customers.',
  btnText: 'Visit',
  btnLink: 'https://www.aon.com/'
}; // blue card props passed into <aon-blue-card>

export const docRows: LinkRow[] = [
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
]; // documents card rows

export const extRows: LinkRow[] = [
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
]; // external links card rows

// ----------  thin wrapper components  ----------

export function ResourceCards({
  docTitle,
  extTitle,
  docRows,
  extRows
}: ResourceProps) {
  // memoize json so custom-element attrs stay stable unless rows change
  const docJson = useMemo(() => JSON.stringify(docRows ?? []), [docRows]);

  // memoize json so custom-element attrs stay stable unless rows change
  const extJson = useMemo(() => JSON.stringify(extRows ?? []), [extRows]);

  return (
    <div className="resource-link-cards">
      <aon-link-card link-title={docTitle} items={docJson} />

      <aon-link-card link-title={extTitle} items={extJson} />
    </div>
  );
}

export function PortalCallout({ title, text, btnText, btnLink }: PortalProps) {
  return (
    <div className="portal-callout">
      <aon-blue-card
        blue-card-title={title}
        blue-card-description={text}
        blue-card-button-text={btnText}
        blue-card-button-link={btnLink}
      />
    </div>
  );
}
