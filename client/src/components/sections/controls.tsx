/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  controls page section

  - react fetches controls using shared api.ts
  - react derives category subnav from fetched api data
  - react bridges subnav clicks to shadow-dom category sections (jump-to-card)
  - react owns page layout (main column + sticky rail)
  - stencil owns subnav rendering + controls card rendering behavior
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { ControlsConnection } from '../../../../types-shared';
import { fetchControlsConnectionAll } from '../../api';
import statusCheckUrl from '../../assets/images/status-check.svg';
import { InfoRail, makeCategoryNav, useSubnavJump } from '../shared';

export default function Controls() {
  const [controlsConn, setControlsConn] = useState<ControlsConnection | null>(
    null
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorText, setErrorText] = useState<string>('');

  const { subnavRef, cardRef, jumpHash } = useSubnavJump(); // shared event + shadow jump bridge

  useEffect(() => {
    let isLive = true; // stop state writes after unmount

    async function load() {
      setIsLoading(true); // start fetch state
      setErrorText(''); // clear prior error before retry

      try {
        const data = await fetchControlsConnectionAll({
          first: 50,
          ttlMs: 60_000
        });

        if (!isLive) return; // ignore late response after unmount

        setControlsConn(data); // store fetched controls connection
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (!isLive) return; // ignore late error after unmount

        setControlsConn(null); // clear stale data
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

  // ---------- honor deep links after stencil card renders categories ----------

  useEffect(() => {
    if (isLoading) return; // wait for data-backed card render
    if (errorText) return; // no jump target when load failed
    if (!controlsConn?.edges?.length) return; // no categories to jump to

    const timerId = window.setTimeout(() => {
      jumpHash(); // tries url hash target inside aon-control-card shadow root
    }, 0); // next tick lets custom element consume latest props before lookup

    return () => {
      window.clearTimeout(timerId); // cleanup if effect re-runs quickly
    };
  }, [isLoading, errorText, controlsConn, jumpHash]);

  const controlsJson = useMemo(() => {
    if (!controlsConn) return '';
    return JSON.stringify(controlsConn);
  }, [controlsConn]); // stencil parses string prop

  const navJson = useMemo(() => {
    const rows = makeCategoryNav(controlsConn, 'controls-category');
    return JSON.stringify(rows);
  }, [controlsConn]); // subnav is derived from same payload as rendered cards

  const emptyText = useMemo(() => {
    if (isLoading) return 'Loading categories...';
    if (errorText) return 'Categories unavailable.';
    return '';
  }, [isLoading, errorText]); // avoid empty card after load unless explicitly needed

  return (
    <section className="info-grid">
      <InfoRail
        subRef={subnavRef}
        navTitle="Categories"
        navJson={navJson}
        emptyText={emptyText}
      />

      <div className="info-main">
        <aon-control-card
          ref={node => {
            cardRef.current = node as HTMLElement | null;
          }} // jump helper searches this host shadow root for category ids
          data-mode="controls"
          show-tile={true}
          show-meta={false}
          icon-src={statusCheckUrl}
          controls-json={controlsJson}
          is-loading={isLoading}
          error-text={errorText}
          section-id-prefix="controls-category"
        />
      </div>
    </section>
  );
}
