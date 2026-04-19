/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  thin react bridge + react-owned trust center content + shared section helpers

  - react owns business copy, urls, and static resource lists
  - stencil owns rendering behavior and visual presentation
  - wrappers only map props and serialize json for stencil
  - shared helpers keep controls/faqs subnav + jump behavior DRY
  - link-card payload shaping + static json stringification are centralized for DRY/perf
  - shared rail + cyqu assistant component keeps controls/faqs layout consistent
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'; // react jsx runtime + shared hooks for stable json + event bridge
import type { AiUiStatus, AiAnswerUi } from '../types-frontend'; // spec-defined state machine type — do not alias or extend
import { askAi } from '../api'; // data-layer helper — only entry point for ai requests (spec phase 4 rule)
import PDF from '../assets/images/pdf-svgrepo-com.svg'; // bundled icon url for pdf rows
import External from '../assets/images/external-link-svgrepo-com.svg'; // bundled icon url for external rows
import ClientPrivacySummaryPDF from '../assets/PDFs/Aon Client Privacy Summary - Mock.pdf'; // bundled mock pdf
import PenetrationTestsPDF from '../assets/PDFs/CyQuPenetrationTestReports.pdf'; // bundled mock pdf
import PrivacyPolicyPDF from '../assets/PDFs/CyQuPrivacyPolicy.pdf'; // bundled mock pdf
import CyberSecurityRiskManagement from '../assets/PDFs/Aon Cyber Security and Risk Management Overview - Mock.pdf'; // bundled mock pdf

// ---------- local ui types ----------

export type LinkRow = {
  label: string; // visible row label
  href: string; // local pdf url or external url
  iconSrc?: string; // optional icon url
  iconAlt?: string; // optional icon alt text
  description?: string; // optional supporting text for richer link rows
  kind?: 'pdf' | 'external' | string; // optional chip source for richer link rows
  ctaLabel?: string; // optional trailing cta label for richer link rows
};

export type LinkCardItem = {
  label: string; // normalized label expected by <aon-link-card>
  href: string; // normalized href expected by <aon-link-card>
  iconSrc?: string; // optional icon url
  iconAlt?: string; // optional icon alt text
  description?: string; // optional supporting text
  kind?: 'pdf' | 'external' | string; // optional chip kind
  ctaLabel?: string; // optional trailing cta label
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

type RailProps = {
  subRef: React.MutableRefObject<HTMLElement | null>; // host ref for aon-subnav-card event listener
  navTitle: string; // subnav title text
  navJson: string; // serialized nav rows
  emptyText: string; // subnav empty/loading text
};

// ---------- shared subnav + jump types (controls/faqs reuse) ----------

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

// ---------- link-card payload helpers (shared resource wrappers) ----------

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''; // normalizes untrusted values to trimmed strings
}

export function toLinkCardItems(
  rows: LinkRow[] | null | undefined
): LinkCardItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return []; // guard non-array callers and empty lists

  const items: LinkCardItem[] = []; // build normalized payload rows for stencil

  for (const row of rows) {
    const label = trimText(row?.label); // normalize visible label
    const href = trimText(row?.href); // normalize destination url

    if (!label || !href) continue; // skip invalid rows quietly so stencil receives clean payload

    const iconSrc = trimText(row?.iconSrc); // normalize optional icon src
    const iconAlt = trimText(row?.iconAlt); // normalize optional icon alt
    const description = trimText(row?.description); // normalize optional supporting text
    const kind = trimText(row?.kind); // normalize optional chip kind
    const ctaLabel = trimText(row?.ctaLabel); // normalize optional cta label

    const item: LinkCardItem = {
      label,
      href
    }; // start with required fields only

    if (iconSrc) item.iconSrc = iconSrc; // only pass optional fields when populated
    if (iconAlt) item.iconAlt = iconAlt; // omit empty alt string unless intentionally provided upstream
    if (description) item.description = description; // keep payload lean when description is absent
    if (kind) item.kind = kind; // keep payload lean when kind is absent
    if (ctaLabel) item.ctaLabel = ctaLabel; // keep payload lean when cta is absent

    items.push(item); // preserve author-defined row order
  }

  return items;
}

export function stringifyLinkCardItems(
  rows: LinkRow[] | null | undefined
): string {
  return JSON.stringify(toLinkCardItems(rows)); // shared serialization path keeps wrapper behavior consistent
}

// ---------- shared subnav helpers (controls/faqs reuse) ----------

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

  const seen = new Set<string>(); // preserve first-seen source order
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

// ---------- cyqu assistant (controls/faqs rail) ----------

const cyquCopy = {
  title: 'CyQu Assistant',
  helper:
    'Ask about controls, FAQs, or resources. Answers include source-backed references.',
  label: 'Ask a Trust Center question',
  placeholder:
    'For example: Explain MFA controls, summarize incident response FAQs...'
} as const; // immutable spec-defined copy — do not paraphrase

export function CyQuAssistant() {
  const triggerRef = useRef<HTMLButtonElement | null>(null); // ref for returning focus on panel close
  const textareaRef = useRef<HTMLTextAreaElement | null>(null); // ref for moving focus to textarea on panel open

  // ---------- state machine (spec.md — exactly these five, no others) ----------
  const [status, setStatus] = useState<AiUiStatus>('idle'); // tracks the five allowed ui states
  const [inputValue, setInputValue] = useState<string>(''); // controlled textarea value
  const [lastSubmitted, setLastSubmitted] = useState<string>(''); // stores trimmed value for retry
  const [isOpen, setIsOpen] = useState<boolean>(false); // disclosure panel open/closed
  const [answer, setAnswer] = useState<AiAnswerUi | null>(null); // normalized api response — null until a successful or fallback response arrives

  // ---------- disclosure toggle (task 3.2) ----------
  function handleToggle() {
    const opening = !isOpen;

    setIsOpen(opening);

    if (opening) {
      // defer focus so the panel is visible before grabbing focus
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } else {
      triggerRef.current?.focus(); // return focus to trigger on close
    }
  }

  // ---------- submit handler (task 3.4 / task 4.2) ----------
  async function handleSubmit() {
    const trimmed = inputValue.trim();

    if (!trimmed) return; // reject empty input (spec behavioral rule)
    if (status === 'submitting') return; // prevent duplicate submissions

    setLastSubmitted(trimmed); // store for retry
    setStatus('submitting');
    setAnswer(null); // clear previous answer before new request

    try {
      const response = await askAi(trimmed);

      if (response.status === 'success') {
        setStatus('success');
        setAnswer(response);
      } else if (response.status === 'fallback') {
        setStatus('fallback');
        setAnswer(response);
      }
      // askAi() throws for any unrecognised status — caught below
    } catch {
      // network failure, unrecognised status, or unexpected throw → error
      setStatus('error');
      setAnswer(null);
    }
  }

  // ---------- retry handler (task 3.5 / task 4.3) ----------
  async function handleRetry() {
    if (!lastSubmitted) return; // nothing to retry
    if (status === 'submitting') return; // prevent duplicate submissions

    setStatus('submitting');
    setAnswer(null); // clear previous answer before retry

    try {
      const response = await askAi(lastSubmitted);

      if (response.status === 'success') {
        setStatus('success');
        setAnswer(response);
      } else if (response.status === 'fallback') {
        setStatus('fallback');
        setAnswer(response);
      }
      // askAi() throws for any unrecognised status — caught below
    } catch {
      // network failure, unrecognised status, or unexpected throw → error
      setStatus('error');
      setAnswer(null);
    }
  }

  // ---------- clear handler (task 3.6) ----------
  function handleClear() {
    setStatus('idle'); // reset state machine
    setInputValue(''); // clear controlled input
    setLastSubmitted(''); // clear retry payload
    setAnswer(null); // clear api response
    setIsOpen(false); // spec.md: Clear resets entire component state including closing the panel
    triggerRef.current?.focus(); // return focus to trigger after panel closes (spec.md focus rule)
  }

  // ---------- derived visibility flags ----------
  const showRetry = status === 'error' || status === 'fallback'; // only visible in terminal error states
  const showClear = status !== 'idle' && status !== 'submitting'; // visible once there is something to clear

  return (
    <section className="cyqu-assistant" aria-label={cyquCopy.title}>
      <div className="cyqu-header">
        <h3 className="cyqu-title">{cyquCopy.title}</h3>

        <p className="cyqu-helper">{cyquCopy.helper}</p>
      </div>

      <button
        ref={triggerRef}
        type="button"
        className="cyqu-trigger"
        aria-expanded={isOpen}
        aria-controls="cyqu-panel"
        onClick={handleToggle}
      >
        Ask a question
      </button>

      <div id="cyqu-panel" className="cyqu-panel" hidden={!isOpen}>
        <div className="cyqu-panel-inner">
          <label className="cyqu-label" htmlFor="cyqu-textarea">
            {cyquCopy.label}
          </label>

          <textarea
            ref={textareaRef}
            id="cyqu-textarea"
            className="cyqu-textarea"
            placeholder={cyquCopy.placeholder}
            rows={4}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />

          <div className="cyqu-actions">
            {status === 'submitting' ? (
              <button type="button" className="cyqu-submit" disabled>
                Searching Trust Center content and preparing an answer…
              </button>
            ) : (
              <button
                type="button"
                className="cyqu-submit"
                onClick={handleSubmit}
                disabled={inputValue.trim() === ''}
              >
                Ask
              </button>
            )}

            {showRetry && (
              <button
                type="button"
                className="cyqu-retry"
                onClick={handleRetry}
              >
                Retry
              </button>
            )}

            {showClear && (
              <button
                type="button"
                className="cyqu-clear"
                onClick={handleClear}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div
          className="cyqu-response"
          aria-live="polite"
          aria-atomic="true"
          data-status={status}
        >
          {status === 'idle' && null}

          {status === 'submitting' && (
            <p className="cyqu-loading">
              Searching Trust Center content and preparing an answer…
            </p>
          )}

          {status === 'error' && (
            <div className="cyqu-error" role="alert">
              <p>
                The assistant could not complete that request. Please try again.
              </p>
            </div>
          )}

          {status === 'success' && answer && (
            <div className="cyqu-answer">
              <p className="cyqu-answer-text">{answer.answer}</p>
              {answer.citations.length > 0 && (
                <ul className="cyqu-citations" aria-label="Sources">
                  {answer.citations.map(citation => (
                    <li key={citation.id} className="cyqu-citation">
                      <span className="cyqu-citation-label">
                        {citation.label}
                      </span>
                      <span className="cyqu-citation-kind">
                        {citation.kind}
                      </span>
                      {citation.category && (
                        <span className="cyqu-citation-category">
                          {citation.category}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {status === 'fallback' && answer && (
            <div className="cyqu-answer cyqu-answer--fallback">
              <p className="cyqu-answer-text">{answer.answer}</p>
              <p className="cyqu-fallback-notice">
                This answer may be based on general knowledge rather than live
                Trust Center data.
              </p>
              {answer.citations.length > 0 && (
                <ul className="cyqu-citations" aria-label="Sources">
                  {answer.citations.map(citation => (
                    <li key={citation.id} className="cyqu-citation">
                      <span className="cyqu-citation-label">
                        {citation.label}
                      </span>
                      <span className="cyqu-citation-kind">
                        {citation.kind}
                      </span>
                      {citation.category && (
                        <span className="cyqu-citation-category">
                          {citation.category}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function InfoRail({ subRef, navTitle, navJson, emptyText }: RailProps) {
  return (
    <aside className="info-rail" aria-label={`${navTitle} and assistant`}>
      <div className="info-stick">
        <aon-subnav-card
          ref={node => {
            subRef.current = node as HTMLElement | null;
          }} // native listener attaches to custom element host
          subnav-card-title={navTitle}
          items-json={navJson}
          empty-text={emptyText}
        />
        <div className="ai-slot-wrapper">
          <CyQuAssistant />
        </div>
      </div>
    </aside>
  );
}

// ---------- react-owned shared content ----------

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
  privacyHref:
    'https://www.aon.com/en/about/leadership-and-governance/privacy-policy',
  privacyLabel: 'Privacy Policy',
  termsHref:
    'https://www.aon.com/getmedia/e93f3b8a-ac9c-4e3d-ba7b-e8fa45bc0640/USA-TERMS.aspx',
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
    href: 'https://ir.aon.com/',
    iconSrc: External,
    iconAlt: ''
  },
  {
    label: 'Aon Newsroom',
    href: 'https://insights-north-america.aon.com/',
    iconSrc: External,
    iconAlt: ''
  }
]; // external links card rows

export const docRowsJson = stringifyLinkCardItems(docRows); // one-time serialization for shared static document rows

export const extRowsJson = stringifyLinkCardItems(extRows); // one-time serialization for shared static external rows

// ---------- thin wrapper components ----------

export function ResourceCards({
  docTitle,
  extTitle,
  docRows: documentRows,
  extRows: externalRows
}: ResourceProps) {
  const docJson = useMemo(() => {
    if (documentRows === docRows) return docRowsJson; // reuse module-level serialized json for static shared rows
    return stringifyLinkCardItems(documentRows); // fallback for callers that pass custom row arrays
  }, [documentRows]);

  const extJson = useMemo(() => {
    if (externalRows === extRows) return extRowsJson; // reuse module-level serialized json for static shared rows
    return stringifyLinkCardItems(externalRows); // fallback for callers that pass custom row arrays
  }, [externalRows]);

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
