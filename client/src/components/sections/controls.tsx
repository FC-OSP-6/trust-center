/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  --> controls page section

  - react fetches controls using shared api.ts
  - stencil renders/groups/expands using passed props
  - api cache prevents duplicate fetches across pages
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import React, { useEffect, useMemo, useState } from 'react';
import type { ControlsConnection } from '../../../../types-shared';
import { fetchControlsConnectionAll } from '../../api';
import statusCheckUrl from '../../assets/images/status-check.svg';

export default function Controls() {
  const [controlsConn, setControlsConn] = useState<ControlsConnection | null>(
    null
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setErrorText('');

      try {
        const data = await fetchControlsConnectionAll({
          first: 50,
          ttlMs: 60_000
        });

        if (!isActive) return;

        setControlsConn(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (!isActive) return;

        setControlsConn(null);
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

  const controlsJson = useMemo(() => {
    if (!controlsConn) return '';
    return JSON.stringify(controlsConn);
  }, [controlsConn]);

  return (
    <section>
      <aon-subnav-card />

      <aon-control-card
        data-mode="controls"
        show-tile={true}
        show-meta={false}
        icon-src={statusCheckUrl}
        controls-json={controlsJson}
        is-loading={isLoading}
        error-text={errorText}
      />
    </section>
  );
}
