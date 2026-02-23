// src/components/aon-control-card/aon-control-card.spec.tsx
import { newSpecPage } from '@stencil/core/testing';
import { ControlCard } from '../src/components/control/control-card';

// Mock fetch globally
global.fetch = jest.fn();

// Mock data for testing
const mockControlsData = {
  data: {
    controlsConnection: {
      totalCount: 5,
      edges: [
        {
          node: {
            id: '1',
            title: 'Access Control Policy',
            description: 'Policy governing access to systems',
            category: 'Security',
            updatedAt: '2024-01-01',
            sourceUrl: 'http://example.com/1'
          }
        },
        {
          node: {
            id: '2',
            title: 'Backup Procedure',
            description: 'Daily backup process',
            category: 'Operations',
            updatedAt: '2024-01-02',
            sourceUrl: null
          }
        },
        {
          node: {
            id: '3',
            title: 'Incident Response',
            description: 'How to respond to incidents',
            category: 'Security',
            updatedAt: '2024-01-03',
            sourceUrl: 'http://example.com/3'
          }
        },
        {
          node: {
            id: '4',
            title: 'Password Policy',
            description: 'Password requirements',
            category: 'Security',
            updatedAt: '2024-01-04',
            sourceUrl: null
          }
        },
        {
          node: {
            id: '5',
            title: 'Change Management',
            description: 'Process for changes',
            category: 'Operations',
            updatedAt: '2024-01-05',
            sourceUrl: 'http://example.com/5'
          }
        }
      ]
    }
  }
};

describe('aon-control-card', () => {
  beforeEach(() => {
    // Reset mock before each test
    (global.fetch as jest.Mock).mockReset();
  });

  // Test 1: Basic loading and rendering when data-mode="none"
  it('renders empty grid when data-mode is "none"', async () => {
    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="none"></aon-control-card>`
    });

    const component = page.rootInstance;
    const element = page.root;

    // Component loaded
    expect(element).toBeTruthy();
    expect(component).toBeInstanceOf(ControlCard);

    // No groups should be loaded
    expect(component.groups).toEqual([]);

    // Grid should be empty
    const grid = element.shadowRoot.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.children.length).toBe(0);

    // No tile header
    expect(element.shadowRoot.querySelector('.tileHeader')).toBeNull();
  });

  // Test 2: Loading state when data-mode="controls"
  it('fetches and renders controls when data-mode="controls"', async () => {
    // Mock successful fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    const component = page.rootInstance;
    const element = page.root;

    // Wait for async operations
    await page.waitForChanges();

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledWith('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: expect.stringContaining('controlsConnection')
    });

    // Check groups were created correctly
    expect(component.groups).toHaveLength(2); // Security and Operations

    // Security group should have 3 controls
    const securityGroup = component.groups.find(g => g.title === 'Security');
    expect(securityGroup).toBeTruthy();
    expect(securityGroup.items).toHaveLength(3);
    expect(securityGroup.items[0].title).toBe('Access Control Policy');

    // Operations group should have 2 controls
    const opsGroup = component.groups.find(g => g.title === 'Operations');
    expect(opsGroup).toBeTruthy();
    expect(opsGroup.items).toHaveLength(2);

    // Total count should be set
    expect(component.totalControls).toBe(5);
  });

  // Test 3: Tile header rendering
  it('renders tile header with correct props', async () => {
    // Mock fetch to return empty data (we're just testing header)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          controlsConnection: {
            totalCount: 10,
            edges: []
          }
        }
      })
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `
        <aon-control-card 
          data-mode="controls"
          show-tile="true"
          title-text="Security Controls"
          subtitle-text="All controls by category"
          show-meta="true"
          icon-src="/icon.svg"
        ></aon-control-card>
      `
    });

    await page.waitForChanges();

    const element = page.root;
    const header = element.shadowRoot.querySelector('.tileHeader');

    expect(header).toBeTruthy();

    // Check title
    const title = element.shadowRoot.querySelector('.tileTitle');
    expect(title).toBeTruthy();
    expect(title.textContent).toBe('Security Controls');

    // Check meta (10 controls, 0 categories because edges empty)
    const meta = element.shadowRoot.querySelector('.tileMeta');
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('10 controls');

    // Check subtitle
    const subtitle = element.shadowRoot.querySelector('.tileSubtitle');
    expect(subtitle).toBeTruthy();
    expect(subtitle.textContent).toBe('All controls by category');
  });

  // Test 4: Category cards rendering
  it('renders category cards correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await page.waitForChanges();

    const element = page.root;
    const cards = element.shadowRoot.querySelectorAll('.card');

    // Should have 2 cards (Security and Operations)
    expect(cards.length).toBe(2);

    // Check first card header
    const firstCard = cards[0];
    const cardHeader = firstCard.querySelector('.cardHeader');
    const cardTitle = firstCard.querySelector('.cardTitle');
    expect(cardTitle.textContent).toBe('Security');

    // Check columns
    const columns = firstCard.querySelector('.columns');
    expect(columns).toBeTruthy();
    expect(columns.querySelector('.colLeft').textContent).toBe('Control');
    expect(columns.querySelector('.colRight').textContent).toBe('Status');

    // Check rows
    const rows = firstCard.querySelectorAll('.row');
    expect(rows.length).toBe(3); // 3 security controls

    // Check first row content
    const firstRow = rows[0];
    expect(firstRow.querySelector('.rowTitle').textContent).toBe(
      'Access Control Policy'
    );
  });

  // Test 5: Expand/collapse functionality
  it('toggles expanded state when header clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await page.waitForChanges();

    const element = page.root;
    const component = page.rootInstance;

    // Initially collapsed (expandedByKey should be empty)
    expect(component.expandedByKey).toEqual({});

    // Find first card header button
    const firstCard = element.shadowRoot.querySelector('.card');
    const headerButton = firstCard.querySelector('.cardHeader');

    // Click to expand
    headerButton.click();
    await page.waitForChanges();

    // Should be expanded
    expect(component.expandedByKey['Security']).toBe(true);
    expect(headerButton.getAttribute('aria-expanded')).toBe('true');

    // Check toggle icon classes
    const toggleIcon = firstCard.querySelector('.aonToggleIcon');
    expect(toggleIcon.classList.contains('isOpen')).toBe(true);

    // Descriptions should be visible now
    const revealWraps = firstCard.querySelectorAll('.aonRevealWrap');
    expect(revealWraps.length).toBe(3);
    expect(revealWraps[0].classList.contains('isOpen')).toBe(true);

    // Click again to collapse
    headerButton.click();
    await page.waitForChanges();

    expect(component.expandedByKey['Security']).toBe(false);
    expect(toggleIcon.classList.contains('isOpen')).toBe(false);
  });

  // Test 6: Status icon rendering
  it('renders correct status icon based on iconSrc prop', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    // Test with custom icon
    const pageWithIcon = await newSpecPage({
      components: [ControlCard],
      html: `
        <aon-control-card 
          data-mode="controls"
          icon-src="/custom-status.svg"
        ></aon-control-card>
      `
    });

    await pageWithIcon.waitForChanges();

    const elementWithIcon = pageWithIcon.root;
    const statusIcon = elementWithIcon.shadowRoot.querySelector('.statusIcon');

    expect(statusIcon).toBeTruthy();
    expect(statusIcon.getAttribute('src')).toBe('/custom-status.svg');

    // Test without icon (should show dot)
    const pageWithoutIcon = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await pageWithoutIcon.waitForChanges();

    const elementWithoutIcon = pageWithoutIcon.root;
    const statusDot = elementWithoutIcon.shadowRoot.querySelector('.statusDot');

    expect(statusDot).toBeTruthy();
    expect(
      elementWithoutIcon.shadowRoot.querySelector('.statusIcon')
    ).toBeNull();
  });

  // Test 7: Error handling
  it('handles fetch errors gracefully', async () => {
    // Mock failed fetch
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await page.waitForChanges();

    const component = page.rootInstance;

    // Groups should be empty (fallback)
    expect(component.groups).toEqual([]);
    expect(component.totalControls).toBe(0);

    // Component should still render without crashing
    const element = page.root;
    expect(element.shadowRoot.querySelector('.grid')).toBeTruthy();

    // Console.warn should have been called
    expect(console.warn).toHaveBeenCalled();
  });

  // Test 8: GraphQL error handling
  it('handles GraphQL errors in response', async () => {
    // Mock GraphQL error response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Invalid query' }]
      })
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await page.waitForChanges();

    const component = page.rootInstance;

    // Should handle error gracefully
    expect(component.groups).toEqual([]);
    expect(component.totalControls).toBe(0);
  });

  // Test 9: FetchFirst prop works
  it('uses fetch-first prop value', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls" fetch-first="50"></aon-control-card>`
    });

    // Check that fetch was called with correct first value
    expect(global.fetch).toHaveBeenCalledWith('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: expect.stringContaining('"first":50')
    });
  });

  // Test 10: Sorting of groups and items
  it('sorts categories and controls alphabetically', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockControlsData
    });

    const page = await newSpecPage({
      components: [ControlCard],
      html: `<aon-control-card data-mode="controls"></aon-control-card>`
    });

    await page.waitForChanges();

    const component = page.rootInstance;

    // Groups should be sorted: Operations, Security (alphabetical)
    expect(component.groups[0].title).toBe('Operations');
    expect(component.groups[1].title).toBe('Security');

    // Security controls should be sorted alphabetically
    const securityGroup = component.groups[1];
    expect(securityGroup.items[0].title).toBe('Access Control Policy');
    expect(securityGroup.items[1].title).toBe('Incident Response');
    expect(securityGroup.items[2].title).toBe('Password Policy');
  });
});
