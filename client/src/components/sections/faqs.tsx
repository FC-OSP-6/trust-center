/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> faqs page section

  - react fetches faqs using shared api.ts
  - stencil renders/groups/expands from passed data
  - api cache keeps route hops fast
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { FaqsConnection } from '../../../../types-shared';
import { fetchFaqsConnectionAll } from '../../api';

export default function Faqs() {
  const [faqsConn, setFaqsConn] = useState<FaqsConnection | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setErrorText('');

      try {
        const data = await fetchFaqsConnectionAll({
          first: 50,
          ttlMs: 60_000
        });

        if (!isActive) return;

        setFaqsConn(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (!isActive) return;

        setFaqsConn(null);
        setErrorText(msg);
      } finally {
        if (!isActive) return;

        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const faqsJson = useMemo(() => {
    if (!faqsConn) return '';
    return JSON.stringify(faqsConn);
  }, [faqsConn]);

  return (
    <section>
      <aon-subnav-card />

      <aon-faq-card
        data-mode="faqs"
        show-tile={true}
        show-meta={false}
        faqs-json={faqsJson}
        is-loading={isLoading}
        error-text={errorText}
      />
    </section>
  );
}
