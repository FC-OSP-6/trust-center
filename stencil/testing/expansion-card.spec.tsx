import { newSpecPage } from '@stencil/core/testing';
import { ExpansionCard } from '../src/components/overview/expansion-card';

const controlsConnection = {
  edges: [
    {
      cursor: '1',
      node: {
        id: 'control-1',
        title: 'Authentication standard is documented and reviewed',
        category: 'Access Control'
      }
    },
    {
      cursor: '2',
      node: {
        id: 'control-2',
        title: 'Privileged access is reviewed quarterly',
        category: 'Access Control'
      }
    },
    {
      cursor: '3',
      node: {
        id: 'control-3',
        title: 'Backup restores are validated regularly',
        category: 'Resilience'
      }
    },
    {
      cursor: '4',
      node: {
        id: 'control-4',
        title: 'Recovery objectives are documented',
        category: 'Resilience'
      }
    }
  ],
  pageInfo: {
    hasNextPage: false,
    endCursor: '4'
  },
  totalCount: 4
};

describe('aon-expansion-card', () => {
  it('renders static bullet list mode and expands overflow', async () => {
    const page = await newSpecPage({
      components: [ExpansionCard],
      html: '<aon-expansion-card card-title="Documents" bullet-points-json="[&quot;Policy&quot;,&quot;Report&quot;,&quot;Summary&quot;,&quot;Checklist&quot;]" preview-limit="2"></aon-expansion-card>'
    });

    expect(page.root?.shadowRoot?.textContent).toContain('Documents');
    expect(page.root?.shadowRoot?.textContent).toContain('+2 more');

    const toggle = page.root?.shadowRoot?.querySelector(
      '.toggle'
    ) as HTMLButtonElement | null;
    toggle?.click();
    await page.waitForChanges();

    expect(page.root?.shadowRoot?.textContent).toContain('Checklist');
    expect(toggle?.textContent).toContain('View Less');
  });

  it('renders grouped controls mode with tile metadata', async () => {
    const page = await newSpecPage({
      components: [ExpansionCard],
      html: `<aon-expansion-card data-mode="controls" show-tile="true" show-meta="true" tile-title="Selected Controls" controls-json='${JSON.stringify(controlsConnection)}'></aon-expansion-card>`
    });

    expect(page.root?.shadowRoot?.textContent).toContain('Selected Controls');
    expect(page.root?.shadowRoot?.textContent).toContain('4 controls');
    expect(page.root?.shadowRoot?.textContent).toContain('2 categories');
    expect(page.root?.shadowRoot?.textContent).toContain('Access Control');
  });

  it('shows loading and error states in controls mode', async () => {
    const loadingPage = await newSpecPage({
      components: [ExpansionCard],
      html: '<aon-expansion-card data-mode="controls" is-loading="true"></aon-expansion-card>'
    });

    expect(loadingPage.root?.shadowRoot?.textContent).toContain(
      'Loading selected controls…'
    );

    const errorPage = await newSpecPage({
      components: [ExpansionCard],
      html: '<aon-expansion-card data-mode="controls" error-text="Categories unavailable."></aon-expansion-card>'
    });

    expect(errorPage.root?.shadowRoot?.textContent).toContain(
      'Failed to load controls.'
    );
    expect(errorPage.root?.shadowRoot?.textContent).toContain(
      'Categories unavailable.'
    );
  });

  it('expands category rows beyond preview limit in controls mode', async () => {
    const page = await newSpecPage({
      components: [ExpansionCard],
      html: `<aon-expansion-card data-mode="controls" controls-json='${JSON.stringify(controlsConnection)}' preview-limit="1"></aon-expansion-card>`
    });

    const toggle = page.root?.shadowRoot?.querySelector(
      '.toggle'
    ) as HTMLButtonElement | null;

    expect(page.root?.shadowRoot?.textContent).toContain('+1 more');

    toggle?.click();
    await page.waitForChanges();

    expect(page.root?.shadowRoot?.textContent).toContain(
      'Privileged access is reviewed quarterly'
    );
  });
});
