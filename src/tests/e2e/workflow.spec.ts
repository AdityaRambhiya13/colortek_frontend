import { test, expect } from '@playwright/test';

test.describe('ColorTek E2E Workflows', () => {
  test('Complete login, workspace selection, and daily production entry creation', async ({ page }) => {
    // 1. Visit the home page
    await page.goto('/');

    // 2. Assert we are on the login screen
    await expect(page.locator('text=Colortek Secure Portal')).toBeVisible();

    // 3. Fill in seeded test user credentials
    await page.fill('input[placeholder="Enter your username"]', 'test_e2e');
    await page.fill('input[placeholder="Enter your password"]', 'test_e2e_password');

    // 4. Click the login button
    await page.click('button[type="submit"]');

    // 5. Assert we are logged in and the dashboard is visible
    // Since the user 'test_e2e' has access to only 1 product workspace ('acro_r1u'), 
    // it automatically logs into that workspace instantly without showing selection screen.
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
    await expect(page.locator('text=ACRO_R1U').first()).toBeVisible();

    // 6. Navigate to Daily Production tab
    // Click the "Production Dept" group to expand navigation options
    await page.click('text=Production Dept');
    
    // Click on "Daily Production"
    await page.click('text=Daily Production');

    // 7. Assert Daily Production subview is active
    await expect(page.locator('text=Daily Production').first()).toBeVisible();

    // Wait for the initial loading process to finish to avoid state override race condition
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 15000 });

    // Wait 500ms to allow React to commit render state and bind event handlers
    await page.waitForTimeout(500);

    // 8. Fill in first row inputs
    // Batch No.
    await page.click('#dp-input-0-batch_no');
    await page.type('#dp-input-0-batch_no', 'E2E-TEST-BATCH');
    // Quantity
    await page.click('#dp-input-0-qty');
    await page.type('#dp-input-0-qty', '125.75');
    // Charged By (User)
    await page.click('#dp-input-0-charged_by');
    await page.type('#dp-input-0-charged_by', 'PLAYWRIGHT');

    // 9. Click "Export" to save the daily production entry
    await page.click('button:has-text("Export")');

    // 10. Assert success toast notification is displayed
    await expect(page.locator('text=Daily Production saved to DB')).toBeVisible({ timeout: 15000 });
  });
});
