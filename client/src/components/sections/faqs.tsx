/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  faqs page section

  - react fetches faqs using shared api.ts
  - react derives category subnav from fetched api data
  - stencil renders subnav + grouped faqs from passed props
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { FaqsConnection } from '../../../../types-shared';
import { fetchFaqsConnectionAll } from '../../api';

// ----------  local subnav types  ----------

type NavRow = {
  label: string; // visible subnav label
  href: string; // fragment href that targets stencil category sections
};

// ----------  local subnav helpers  ----------

function slugText(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
} // keep slug logic aligned with stencil card id generation

function makeNav(conn: FaqsConnection | null, idHead: string): NavRow[] {
  if (!conn?.edges?.length) return [];

  const seen = new Set<string>(); // preserve first-seen api order
  const rows: NavRow[] = [];

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

export default function Faqs() {
  const [faqsConn, setFaqsConn] = useState<FaqsConnection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    let isLive = true; // stop state writes after unmount

    async function load() {
      setIsLoading(true); // start fetch state
      setErrorText(''); // clear prior error before retry

      try {
        const data = await fetchFaqsConnectionAll({
          first: 50,
          ttlMs: 60_000
        });

        if (!isLive) return; // ignore late response after unmount

        setFaqsConn(data); // store fetched faq connection
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (!isLive) return; // ignore late error after unmount

        setFaqsConn(null); // clear stale data
        setErrorText(msg); // expose readable error
      } finally {
        if (!isLive) return; // ignore late completion after unmount

        setIsLoading(false); // stop loading state
      }
    }

    void load(); // fire load once on mount

    return () => {
      isLive = false; // mark effect inactive on unmount
    };
  }, []);

  const faqsJson = useMemo(() => {
    if (!faqsConn) return '';
    return JSON.stringify(faqsConn);
  }, [faqsConn]); // stencil parses string prop

  const navJson = useMemo(() => {
    const rows = makeNav(faqsConn, 'faq-category');
    return JSON.stringify(rows);
  }, [faqsConn]); // subnav is derived from the same api payload

  const emptyText = useMemo(() => {
    if (isLoading) return 'Loading categories...';
    if (errorText) return 'Categories unavailable.';
    return '';
  }, [isLoading, errorText]); // avoid empty card after load unless explicitly needed

  return (
    <section>
      <aon-subnav-card
        subnav-card-title="FAQ Categories"
        items-json={navJson}
        empty-text={emptyText}
      />

      <aon-faq-card
        data-mode="faqs"
        show-tile={true}
        show-meta={false}
        faqs-json={faqsJson}
        is-loading={isLoading}
        error-text={errorText}
        section-id-prefix="faq-category"
      />
    </section>
  );
}
