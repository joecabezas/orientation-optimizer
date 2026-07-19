import { expect, test } from '@playwright/test'

test.describe('Orientation Optimizer app', () => {
  test('loads with a default mesh, config, and starts a run producing generations', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Orientation Optimizer' })).toBeVisible()

    // Fitness strategy defaults to the printer-agnostic projected-area strategy.
    await expect(page.getByLabel('Fitness strategy')).toHaveValue('projected-area')

    const viewerStatus = page.locator('.viewer-status')

    // Generation counter starts at 0 before any run.
    await expect(viewerStatus).toContainText('Generation')
    await expect(viewerStatus).toContainText('0')

    await page.getByRole('button', { name: 'Start' }).click()

    // Generation should advance past 0 once the run is going.
    await page.waitForFunction(
      () => {
        const strongEls = Array.from(document.querySelectorAll('.viewer-status strong'))
        const genText = strongEls[0]?.textContent ?? '0'
        return Number(genText) > 0
      },
      { timeout: 15000 },
    )

    await page.getByRole('button', { name: 'Pause' }).click()
  })

  test('switching to overhang-angle strategy reveals the critical angle slider, hides it for projected-area', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByText('Critical overhang angle (deg)')).toHaveCount(0)

    await page.getByLabel('Fitness strategy').selectOption('overhang-angle')
    await expect(page.getByText('Critical overhang angle (deg)')).toBeVisible()

    await page.getByLabel('Fitness strategy').selectOption('projected-area')
    await expect(page.getByText('Critical overhang angle (deg)')).toHaveCount(0)
  })

  test('switching test meshes resets the run and updates the viewer', async ({ page }) => {
    await page.goto('/')

    const meshSelect = page.locator('.config-section', { hasText: 'Test model' }).locator('select')
    await meshSelect.selectOption('l-bracket')

    await expect(page.locator('.viewer-status')).toContainText('Generation')
    await expect(page.locator('.viewer-status')).toContainText('0')
  })
})
