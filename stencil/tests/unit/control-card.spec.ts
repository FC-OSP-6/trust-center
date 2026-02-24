// stencil/tests/unit/aon-control-card.spec.ts
import { test, expect } from '@playwright/test';

test('aon-control-card renders properly with grouped controls', async ({
  page
}) => {
  // Sample ControlsConnection JSON payload
  const controlsJson = JSON.stringify({
    totalCount: 2,
    edges: [
      {
        node: {
          id: '1',
          title: 'Control One',
          category: 'Security',
          description: 'Desc 1'
        }
      },
      {
        node: {
          id: '2',
          title: 'Control Two',
          category: 'Security',
          description: 'Desc 2'
        }
      }
    ]
  });

  // Mount component
  await page.setContent(`
    <html>
      <body>
        <aon-control-card 
          data-mode="controls"
          show-tile="true"
          title-text="Selected Controls"
          show-meta="true"
          controls-json='${controlsJson}'>
        </aon-control-card>
        <script type="module" src="/build/trust-center.esm.js"></script>
      </body>
    </html>
  `);

  // Wait for the component to render shadow DOM content
  const card = page.locator('aon-control-card');

  // Verify the tile header title
  const tileTitle = card.locator('h2');
  await expect(tileTitle).toHaveText('SOC 2 Controls');

  // Verify the meta text
  const meta = card.locator('.tile-meta');
  await expect(meta).toHaveText('2 controls 1 categories');

  // Verify grouped control items
  const rows = card.locator('ul.rows li.row');
  await expect(rows).toHaveCount(2);

  // Verify first control row
  const firstRowTitle = rows.nth(0).locator('.row-title');
  await expect(firstRowTitle).toHaveText('Control One');

  const firstRowDesc = rows.nth(0).locator('.aon-reveal-inner');
  await expect(firstRowDesc).toHaveText('Desc 1');

  // Verify second control row
  const secondRowTitle = rows.nth(1).locator('.row-title');
  await expect(secondRowTitle).toHaveText('Control Two');

  const secondRowDesc = rows.nth(1).locator('.aon-reveal-inner');
  await expect(secondRowDesc).toHaveText('Desc 2');
});
