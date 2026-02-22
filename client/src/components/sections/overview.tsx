/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  overview page section (react thin + stencil ui logic)

  - react fetches controls through client/src/api.ts
  - api cache + in-flight dedupe prevents duplicate refetching
  - react passes data + status into stencil expansion component
  - resources + portal callout render through thin wrappers around stencil components
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react'; // react hooks for fetch lifecycle + memoized json props
import type { ControlsConnection } from '../../../../types-shared'; // shared connection type used by frontend
import { fetchControlsConnectionAll } from '../../api'; // compatibility alias preserved in api.ts
import { PortalCallout, ResourceCards } from '../shared'; // thin react wrappers around stencil components
import statusCheckUrl from '../../assets/images/status-check.svg'; // icon passed into expansion-card

export default function Overview() {
  // ----------  local fetch state  ----------

  const [controlsConn, setControlsConn] = useState<ControlsConnection | null>(
    null
  ); // fetched controls connection
  const [isLoading, setIsLoading] = useState<boolean>(true); // loading flag for stencil component
  const [errorText, setErrorText] = useState<string>(''); // normalized error text for stencil component

  // ----------  load once (api layer handles cache + dedupe)  ----------

  useEffect(() => {
    let isActive = true; // prevents state updates after unmount

    async function load() {
      setIsLoading(true); // start loading state
      setErrorText(''); // clear previous error before new request

      try {
        const data = await fetchControlsConnectionAll({
          first: 50, // resolver cap-safe  --> api also clamps to 50
          ttlMs: 60_000 // longer ttl for overview page stability during navigation
        });

        if (!isActive) return; // skip state updates after unmount

        setControlsConn(data); // store fetched controls connection
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err); // normalize unknown thrown values

        if (!isActive) return; // skip state updates after unmount

        setControlsConn(null); // clear stale data on failure
        setErrorText(msg); // surface readable error message
      } finally {
        if (!isActive) return; // skip state updates after unmount

        setIsLoading(false); // end loading state
      }
    }

    void load(); // fire and intentionally ignore promise

    return () => {
      isActive = false; // mark effect inactive on unmount
    };
  }, []); // run once on mount

  // ----------  memoized json handoff (stencil parses string prop)  ----------

  const controlsJson = useMemo(() => {
    if (!controlsConn) return ''; // empty string means "no data" for stencil parsing
    return JSON.stringify(controlsConn); // stable serialized payload until data changes
  }, [controlsConn]);

  // ----------  render  ----------

  return (
    <section className="overview-section">
      {/* resources section (stencil-rendered via thin react wrapper) */}
      <ResourceCards />

      {/* portal callout (stencil-rendered via thin react wrapper) */}
      <PortalCallout buttonText="Visit" />

      {/* selected controls section (react passes data/state, stencil renders UI behavior) */}
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
