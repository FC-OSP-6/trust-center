/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  overview page section

  - react fetches controls through client/src/api.ts
  - api cache + in-flight dedupe prevents duplicate refetching
  - react passes data + status into stencil expansion component
  - resources + portal callout render through prop-driven wrappers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { ControlsConnection } from '../../../../types-shared';
import { fetchControlsConnectionAll } from '../../api';
import {
  PortalCallout,
  ResourceCards,
  docRows,
  extRows,
  portalCard
} from '../shared';
import statusCheckUrl from '../../assets/images/status-check.svg';

export default function Overview() {
  // ----------  local fetch state  ----------

  const [controlsConn, setControlsConn] = useState<ControlsConnection | null>(
    null
  ); // fetched controls connection

  const [isLoading, setIsLoading] = useState<boolean>(true); // loading flag for stencil component

  const [errorText, setErrorText] = useState<string>(''); // normalized error text for stencil component

  // ----------  load once (api layer handles cache + dedupe)  ----------

  useEffect(() => {
    let isLive = true; // prevents state updates after unmount

    async function load() {
      setIsLoading(true); // start loading state
      setErrorText(''); // clear previous error before new request

      try {
        const data = await fetchControlsConnectionAll({
          first: 50, // resolver cap-safe
          ttlMs: 60_000 // longer ttl for route hops
        });

        if (!isLive) return; // skip state updates after unmount

        setControlsConn(data); // store fetched controls connection
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err); // normalize thrown value

        if (!isLive) return; // skip state updates after unmount

        setControlsConn(null); // clear stale data on failure
        setErrorText(msg); // surface readable error
      } finally {
        if (!isLive) return; // skip state updates after unmount

        setIsLoading(false); // end loading state
      }
    }

    void load(); // fire and intentionally ignore promise

    return () => {
      isLive = false; // mark effect inactive on unmount
    };
  }, []);

  // ----------  memoized json handoff (stencil parses string prop)  ----------

  const controlsJson = useMemo(() => {
    if (!controlsConn) return ''; // empty string means no data yet
    return JSON.stringify(controlsConn); // serialized payload for stencil prop
  }, [controlsConn]);

  // ----------  render  ----------

  return (
    <section className="overview-section">
      {/* resources section (stencil-rendered via thin react wrapper) */}
      <ResourceCards
        docTitle="Documents"
        extTitle="External Links"
        docRows={docRows}
        extRows={extRows}
      />

      {/* portal callout (stencil-rendered via thin react wrapper) */}
      <PortalCallout
        title={portalCard.title}
        text={portalCard.text}
        btnText={portalCard.btnText}
        btnLink={portalCard.btnLink}
      />

      {/* selected controls section (react passes data/state, stencil renders ui behavior) */}
      <div className="overview-selected-controls">
        <aon-expansion-card
          data-mode="controls"
          show-tile={true}
          tile-title="Selected Controls"
          show-meta={true}
          tile-subtitle=""
          preview-limit={3}
          category-limit={3}
          icon-src={statusCheckUrl}
          controls-json={controlsJson}
          is-loading={isLoading}
          error-text={errorText}
        />
      </div>
    </section>
  );
}
