/* @vitest-environment node */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  InfoRail,
  PortalCallout,
  ResourceCards,
  docRows,
  extRows
} from '../../client/src/components/shared';

describe('shared react-to-stencil bridges', () => {
  it('renders InfoRail with subnav and assistant shell markup', () => {
    const subRef = { current: null as HTMLElement | null };
    const html = renderToStaticMarkup(
      React.createElement(InfoRail, {
        subRef,
        navTitle: 'Categories',
        navJson: JSON.stringify([
          { label: 'Access Control', href: '#controls-category-access-control' }
        ]),
        emptyText: 'Loading categories...'
      })
    );

    expect(html).toContain('aon-subnav-card');
    expect(html).toContain('subnav-card-title="Categories"');
    expect(html).toContain('CyQu Assistant');
  });

  it('renders resource and portal wrappers with custom-element props', () => {
    const resourcesHtml = renderToStaticMarkup(
      React.createElement(ResourceCards, {
        docTitle: 'Documents',
        extTitle: 'External Links',
        docRows,
        extRows
      })
    );
    const portalHtml = renderToStaticMarkup(
      React.createElement(PortalCallout, {
        title: 'Aon Trust Portal',
        text: 'Visit the main portal.',
        btnText: 'Visit',
        btnLink: 'https://www.aon.com/'
      })
    );

    expect(resourcesHtml).toContain('aon-link-card');
    expect(resourcesHtml).toContain('link-title="Documents"');
    expect(resourcesHtml).toContain('link-title="External Links"');

    expect(portalHtml).toContain('aon-blue-card');
    expect(portalHtml).toContain('blue-card-title="Aon Trust Portal"');
    expect(portalHtml).toContain('blue-card-button-text="Visit"');
  });
});
