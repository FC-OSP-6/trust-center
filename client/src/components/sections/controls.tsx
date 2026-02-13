/* ================================
  TL;DR  --> A button that when clicked expands to show the following subsections: 
      1. Infrastructure Security
      2. Organizational Security
      3. Product Security
      4. Internal Security Procedures
      5. Data and Privacy
================================ */
import React, { useEffect, useMemo, useState } from 'react';

import { fetchControlsConnectionPage } from '../../api';
import type { Control } from '../../types-frontend';

export default function Controls() {
  // ui state  -->  basic loading/errors for mvp visibility
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // data state  -->  store nodes only (ui cares about the node payload)
  const [items, setItems] = useState<Control[]>([]);

  // computed view  -->  stable derived list for rendering
  const controls = useMemo(() => items, [items]);

  useEffect(() => {
    let isActive = true; // guards state updates after unmount

    async function load() {
      setIsLoading(true);
      setErrorText(null);

      try {
        // first page only  -->  enough to prove db + graphql + ui wiring
        const res = await fetchControlsConnectionPage({ first: 25 });

        // flatten edges -> nodes  -->  simplest ui contract
        const nodes = res.edges.map((e) => e.node);

        if (!isActive) return;
        setItems(nodes);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown controls fetch error';

        if (!isActive) return;
        setErrorText(msg);
        setItems([]); // keep the visual state deterministic
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    }

    load();

    return () => {
      isActive = false; // cleanup flag
    };
  }, []);

  return (
    <section>
      <aon-subnav-card />

      {/* status text  -->  keeps debugging fast during mvp */}
      <div>
        {isLoading && <p>loading controls...</p>}
        {errorText && <p>error: {errorText}</p>}
        {!isLoading && !errorText && <p>controls loaded: {controls.length}</p>}
      </div>

      {/* render data plainly  -->  avoids guessing stencil prop names */}
      <ul>
        {controls.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong>
            <div>{c.category}</div>
            <div>{c.description}</div>
            <div>updated: {c.updatedAt}</div>
          </li>
        ))}
      </ul>

      {/* existing stencil placeholders  -->  keep layout components visible */}
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
      <aon-control-card />
    </section>
  );
}
