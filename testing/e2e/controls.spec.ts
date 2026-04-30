/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  data-backed browser smoke + outage fallback tests

  what this file proves:
  - overview, controls, and faqs render stable user-visible content when graphql is healthy
  - browser-level graphql failures still render seed-backed fallback ui instead of fatal empty/error states
  - bun-driven playwright coverage now protects the sprint-critical demo routes directly
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const overviewPath = './overview';
const controlsPath = './controls';
const faqsPath = './faqs';
const controlTitle = 'Authentication standard is documented and reviewed';
const faqQuestion =
  'How does CyQu manage authentication within access control?';

async function mockHealthyGraphql(page: Page) {
  await page.route('**/graphql', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          controlsConnection: {
            edges: [
              {
                cursor: '1',
                node: {
                  id: 'control-1',
                  controlKey: 'ac-1',
                  title: controlTitle,
                  description:
                    'The platform documents and reviews authentication guidance.',
                  category: 'Access Control',
                  section: 'Identity',
                  subcategory: null,
                  tags: [],
                  sourceUrl: null,
                  updatedAt: '2026-01-01T00:00:00.000Z'
                }
              }
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: '1'
            },
            totalCount: 1
          },
          faqsConnection: {
            edges: [
              {
                cursor: '1',
                node: {
                  id: 'faq-1',
                  faqKey: 'auth-1',
                  question: faqQuestion,
                  answer: 'CyQu uses role-based access with periodic review.',
                  category: 'Access Control',
                  section: 'Identity',
                  subcategory: null,
                  tags: [],
                  updatedAt: '2026-01-01T00:00:00.000Z'
                }
              }
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: '1'
            },
            totalCount: 1
          }
        }
      })
    });
  });
}

async function forceGraphqlFailure(page: Page) {
  await page.route('**/graphql', async route => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        errors: [{ message: 'Upstream unavailable during fallback smoke test' }]
      })
    });
  });
}

test.describe('trust center data routes', () => {
  test('healthy data routes render stable overview controls and faq content', async ({
    page
  }) => {
    await mockHealthyGraphql(page);

    await page.goto(overviewPath);

    await expect(page.getByText('Documents', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Selected Controls', { exact: true })
    ).toBeVisible();
    await expect(page.getByText(controlTitle, { exact: true })).toBeVisible();

    await page.goto(controlsPath);

    await expect(page.getByText('Categories', { exact: true })).toBeVisible();
    await expect(
      page.getByText('CyQu Assistant', { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Access Control' })
    ).toBeVisible();
    await expect(page.getByText(controlTitle, { exact: true })).toBeVisible();

    await page.goto(faqsPath);

    await expect(
      page.getByText('FAQ Categories', { exact: true })
    ).toBeVisible();
    await expect(page.locator('aon-faq-card button').first()).toBeVisible();
  });

  test('graphql outages still render mock-backed overview controls and faq content', async ({
    page
  }) => {
    await forceGraphqlFailure(page);

    await page.goto(overviewPath);

    await expect(
      page.getByText('Selected Controls', { exact: true })
    ).toBeVisible();
    await expect(page.getByText(controlTitle, { exact: true })).toBeVisible();
    await expect(page.getByText('Failed to load controls.')).toHaveCount(0);

    await page.goto(controlsPath);

    await expect(page.getByText('Categories', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Access Control' })
    ).toBeVisible();
    await expect(page.getByText(controlTitle, { exact: true })).toBeVisible();
    await expect(
      page.getByText('NETWORK_ERROR:', { exact: false })
    ).toHaveCount(0);

    await page.goto(faqsPath);

    await expect(
      page.getByText('FAQ Categories', { exact: true })
    ).toBeVisible();
    await expect(page.getByText(faqQuestion)).toBeVisible();
    await expect(page.getByText(/^error:/i)).toHaveCount(0);
  });
});
