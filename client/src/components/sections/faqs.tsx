/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  faqs page section

  - react fetches faqs using shared api.ts
  - react derives category subnav from fetched api data
  - react bridges subnav clicks to shadow-dom category sections (jump-to-card)
  - stencil renders subnav + grouped faqs from passed props
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { FaqsConnection } from '../../../../types-shared';
import { fetchFaqsConnectionAll } from '../../api';
import { makeCategoryNav, useSubnavJump } from '../shared';

export default function Faqs() {
  const [faqsConn, setFaqsConn] = useState<FaqsConnection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorText, setErrorText] = useState<string>('');

  const { subnavRef, cardRef, jumpHash } = useSubnavJump(); // shared event + shadow jump bridge

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

  // ----------  honor deep links after stencil card renders categories  ----------

  useEffect(() => {
    if (isLoading) return; // wait for data-backed card render
    if (errorText) return; // no jump target when load failed
    if (!faqsConn?.edges?.length) return; // no categories to jump to

    const timerId = window.setTimeout(() => {
      jumpHash(); // tries url hash target inside aon-faq-card shadow root
    }, 0); // next tick lets custom element consume latest props before lookup

    return () => {
      window.clearTimeout(timerId); // cleanup if effect re-runs quickly
    };
  }, [isLoading, errorText, faqsConn, jumpHash]);

  const faqsJson = useMemo(() => {
    if (!faqsConn) return '';
    return JSON.stringify(faqsConn);
  }, [faqsConn]); // stencil parses string prop

  const navJson = useMemo(() => {
    const rows = makeCategoryNav(faqsConn, 'faq-category');
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
        ref={node => {
          subnavRef.current = node as HTMLElement | null;
        }} // native listener attaches to custom element host
        subnav-card-title="FAQ Categories"
        items-json={navJson}
        empty-text={emptyText}
      />

      <aon-faq-card
        ref={node => {
          cardRef.current = node as HTMLElement | null;
        }} // jump helper searches this host's shadow root for category ids
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
