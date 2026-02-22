/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  thin react bridge + react-owned trust center content + shared section helpers

  - react owns business copy, urls, and static resource lists
  - stencil owns rendering behavior and visual presentation
  - wrappers only map props and serialize json for stencil
  - shared helpers keep controls/faqs subnav + jump behavior DRY
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useCallback, useEffect, useMemo, useRef } from 'react'; // react jsx runtime + shared hooks for stable json + event bridge
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

// ----------  shared subnav + jump types (controls/faqs reuse)  ----------

export type SubnavRow = {
  label: string; // visible subnav label
  href: string; // fragment href that targets stencil category sections
};

type CategoryNode = {
  category?: string | null; // category field used by controls/faqs cards
};

type CategoryEdge = {
  node?: CategoryNode | null; // edge wrapper shape from graphql connection
};

type CategoryConn = {
  edges?: Array<CategoryEdge | null> | null; // minimal structural shape needed for subnav derivation
} | null;

type SubnavJumpDetail = {
  href?: string; // original href emitted by stencil subnav card
  id?: string; // parsed target id emitted by stencil subnav card
};

// ----------  shared subnav helpers (controls/faqs reuse)  ----------

export function slugText(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
} // keep slug logic aligned with stencil card id generation

export function makeCategoryNav(
  conn: CategoryConn,
  idHead: string
): SubnavRow[] {
  if (!conn?.edges?.length) return [];

  const seen = new Set<string>(); // preserve first-seen api order
  const rows: SubnavRow[] = [];

  for (const edge of conn.edges) {
    const rawName = edge?.node?.category || 'General'; // fallback for missing data
    const name = rawName.trim();

    if (!name) continue; // skip blank category names
    if (seen.has(name)) continue; // dedupe repeated category names

    const slug = slugText(name);

    if (!slug) continue; // skip non-sluggable names

    seen.add(name);

    rows.push({
      label: name,
      href: `#${idHead}-${slug}`
    });
  }

  return rows;
}

function parseHashId(hashLike: string): string {
  const text = (hashLike ?? '').trim();

  if (!text) return '';

  const hash = text.startsWith('#') ? text : `#${text}`; // normalize caller input to hash form
  const id = hash.slice(1).trim(); // remove hash prefix

  return id;
}

function setHash(id: string) {
  if (typeof window === 'undefined') return; // client-only helper
  if (!id) return; // skip empty ids

  const nextHash = `#${id}`;

  if (window.location.hash === nextHash) return; // avoid redundant history writes

  window.history.replaceState(null, '', nextHash); // keep URL shareable without extra history entry
}

function scrollShadowId(host: HTMLElement | null, id: string): boolean {
  if (!host || !id) return false; // guard missing refs or ids

  const root = host.shadowRoot; // category targets live inside stencil shadow dom

  if (!root) return false; // host not ready yet

  const target = root.getElementById(id); // ids are slug-based and safe for direct lookup

  if (!(target instanceof HTMLElement)) return false; // target not rendered yet or id mismatch

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  }); // native smooth scroll to category card

  return true;
}

function readJump(event: Event): { id: string; href: string } | null {
  const custom = event as CustomEvent<SubnavJumpDetail>; // native listener receives custom event from stencil
  const detail = custom.detail ?? {}; // tolerate malformed payloads
  const href = (detail.href ?? '').trim();
  const id = parseHashId(detail.id ?? href); // prefer explicit id, fallback to href fragment

  if (!id) return null;

  return {
    id,
    href
  };
}

export function useSubnavJump() {
  const subnavRef = useRef<HTMLElement | null>(null); // host for aon-subnav-card (event source)
  const cardRef = useRef<HTMLElement | null>(null); // host for aon-control-card / aon-faq-card (scroll target root)

  const jumpId = useCallback((id: string): boolean => {
    const ok = scrollShadowId(cardRef.current, id); // find target inside card shadow root and scroll

    if (ok) {
      setHash(id); // keep url fragment in sync after successful jump
    }

    return ok;
  }, []);

  const jumpHash = useCallback((): boolean => {
    if (typeof window === 'undefined') return false; // client-only helper

    const id = parseHashId(window.location.hash); // read current url fragment

    if (!id) return false; // no fragment to honor

    return jumpId(id); // attempt scroll into current card shadow root
  }, [jumpId]);

  useEffect(() => {
    const subnavEl = subnavRef.current; // current subnav host at mount time

    if (!subnavEl) return; // no host yet (should be rare after mount)

    function onJump(event: Event) {
      const detail = readJump(event); // parse typed custom event payload

      if (!detail) return; // ignore malformed events

      jumpId(detail.id); // scroll matching category section inside target card shadow root
    }

    subnavEl.addEventListener('aonSubnavJump', onJump); // native listener for stencil custom event

    return () => {
      subnavEl.removeEventListener('aonSubnavJump', onJump); // cleanup on unmount
    };
  }, [jumpId]);

  return {
    subnavRef, // assign to aon-subnav-card host
    cardRef, // assign to aon-control-card / aon-faq-card host
    jumpHash // call after data renders to honor deep-link fragments
  };
}

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
