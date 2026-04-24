import { newSpecPage } from '@stencil/core/testing';
import { ControlCard } from '../src/components/control/control-card';

const controlsConnection = {
  edges: [
    {
      cursor: '1',
      node: {
        id: 'control-1',
        controlKey: 'ac-1',
        title: 'Authentication standard is documented and reviewed',
        description:
          'The platform documents and reviews authentication guidance.',
        category: 'Access Control',
        section: 'Identity',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      cursor: '2',
      node: {
        id: 'control-2',
        controlKey: 'ac-2',
        title: 'Privileged access is reviewed quarterly',
        description: 'Privileged access reviews are tracked every quarter.',
        category: 'Access Control',
        section: 'Identity',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    },
    {
      cursor: '3',
      node: {
        id: 'control-3',
        controlKey: 'dp-1',
        title: 'Backups are encrypted at rest',
        description: 'Stored backups are encrypted using managed keys.',
        category: 'Data Protection',
        section: 'Resilience',
        updatedAt: '2026-01-03T00:00:00.000Z'
      }
    }
  ],
  pageInfo: {
    hasNextPage: false,
    endCursor: '3'
  },
  totalCount: 3
};

describe('aon-control-card', () => {
  it('renders loading state before grouped data exists', async () => {
    const page = await newSpecPage({
      components: [ControlCard],
      html: '<aon-control-card data-mode="controls" is-loading="true"></aon-control-card>'
    });

    expect(page.root?.shadowRoot?.textContent).toContain('Loading controls...');
  });

  it('renders grouped categories from controls-json', async () => {
    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls" controls-json='${JSON.stringify(controlsConnection)}'></aon-control-card>`
    });

    const categoryTitles = Array.from(
      page.root?.shadowRoot?.querySelectorAll('.card-title') ?? []
    ).map(node => node.textContent?.trim());

    expect(categoryTitles).toEqual(['Access Control', 'Data Protection']);
    expect(page.root?.shadowRoot?.textContent).toContain(
      'Authentication standard is documented and reviewed'
    );
  });

  it('expands descriptions when a category header is clicked', async () => {
    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls" controls-json='${JSON.stringify(controlsConnection)}'></aon-control-card>`
    });

    const firstHeader = page.root?.shadowRoot?.querySelector(
      '.card-header'
    ) as HTMLButtonElement | null;
    const revealWrap = page.root?.shadowRoot?.querySelector(
      '.aon-reveal-wrap'
    ) as HTMLElement | null;

    expect(revealWrap?.className).not.toContain('is-open');

    firstHeader?.click();
    await page.waitForChanges();

    expect(revealWrap?.className).toContain('is-open');
  });

  it('prefers external error text over parsed content', async () => {
    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls" controls-json='${JSON.stringify(controlsConnection)}' error-text="Categories unavailable."></aon-control-card>`
    });

    const alert = page.root?.shadowRoot?.querySelector('[role="alert"]');

    expect(alert?.textContent).toContain('Categories unavailable.');
    expect(page.root?.shadowRoot?.textContent).not.toContain(
      'Loading controls...'
    );
  });
});
