/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  TL;DR  -->  app-level e2e smoke tests (react router + shell visibility)

  what this file proves first:
  - playwright can launch the app in local chrome
  - root route redirects to /overview
  - shell components render on known trust-center routes
  - fallback route renders not found and hides shell chrome

  why this is a strong first e2e test:
  - validates routing + app boot without brittle page-specific selectors
  - catches base-path issues (/trust-center) immediately
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

import { test, expect } from '@playwright/test';

// ---------- app routing smoke ----------

test.describe('trust center app smoke', () => {
  test('root route redirects to overview and renders shell chrome', async ({
    page
  }) => {
    await page.goto('./'); // baseURL already includes /trust-center

    await expect(page).toHaveURL(/\/trust-center\/overview$/); // App redirects "/" -> "/overview"

    // shell chrome should render on known routes (showShell = true)
    await expect(page.locator('aon-header')).toHaveCount(1);
    await expect(page.locator('aon-title')).toHaveCount(1);
    await expect(page.locator('aon-navbar')).toHaveCount(1);
    await expect(page.locator('aon-footer')).toHaveCount(1);

    // active-path is a strong signal that route normalization is working
    await expect(page.locator('aon-navbar')).toHaveAttribute(
      'active-path',
      '/trust-center/overview'
    );

    // main app container should exist for page content
    await expect(page.locator('main.trust-center-main')).toBeVisible();

    // fallback content should not be present on a valid route
    await expect(
      page.getByRole('heading', { name: 'Not Found', exact: true })
    ).toHaveCount(0);
  });

  test('unknown route shows not found and hides shell chrome', async ({
    page
  }) => {
    await page.goto('./does-not-exist'); // react-router fallback route

    await expect(page).toHaveURL(/\/trust-center\/does-not-exist$/); // no redirect expected here

    // fallback page should render
    await expect(
      page.getByRole('heading', { name: 'Not Found', exact: true })
    ).toBeVisible();

    await expect(
      page.getByText('The page you requested does not exist.')
    ).toBeVisible();

    // shell chrome should be hidden when path is not one of the known routes
    await expect(page.locator('aon-header')).toHaveCount(0);
    await expect(page.locator('aon-title')).toHaveCount(0);
    await expect(page.locator('aon-navbar')).toHaveCount(0);
    await expect(page.locator('aon-footer')).toHaveCount(0);
  });
});
