import { expect, test } from '@playwright/test'

test.describe('Orientation Optimizer app', () => {
  test('loads with a default mesh, config, and starts a run producing generations', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Orientation Optimizer' })).toBeVisible()

    // Fitness strategy defaults to support-aware (height + contact penalty).
    await expect(page.getByRole('radio', { name: /support-aware/i })).toBeChecked()

    const viewerStatus = page.getByTestId('viewer-status')

    // Generation counter starts at 0 before any run.
    await expect(viewerStatus).toContainText('Generation')
    await expect(viewerStatus).toContainText('0')

    await page.getByRole('button', { name: '+10' }).click()

    // Generation should advance past 0 once the run is going.
    await page.waitForFunction(
      () => {
        const strongEls = Array.from(document.querySelectorAll('[data-testid="viewer-status"] strong'))
        const genText = strongEls[0]?.textContent ?? '0'
        return Number(genText) > 0
      },
      { timeout: 15000 },
    )

    await page.getByRole('button', { name: 'Pause' }).click()
  })

  test('critical angle slider shows for overhang-angle and support-aware, hides for projected-area', async ({
    page,
  }) => {
    await page.goto('/')

    // Default strategy is support-aware, which also needs the critical angle.
    await expect(page.getByText('Critical overhang angle (deg)')).toBeVisible()

    await page.getByRole('radio', { name: /projected area/i }).check()
    await expect(page.getByText('Critical overhang angle (deg)')).toHaveCount(0)

    await page.getByRole('radio', { name: /overhang angle/i }).check()
    await expect(page.getByText('Critical overhang angle (deg)')).toBeVisible()

    await page.getByRole('radio', { name: /projected area/i }).check()
    await expect(page.getByText('Critical overhang angle (deg)')).toHaveCount(0)
  })

  test('switching test meshes resets the run and updates the viewer', async ({ page }) => {
    await page.goto('/')

    const meshSelect = page.getByTestId('mesh-select')
    await meshSelect.selectOption('l-bracket')

    await expect(page.getByTestId('viewer-status')).toContainText('Generation')
    await expect(page.getByTestId('viewer-status')).toContainText('0')
  })

  test('lists the new oblique-optimum test meshes', async ({ page }) => {
    await page.goto('/')

    const meshSelect = page.getByTestId('mesh-select')
    await expect(meshSelect.locator('option[value="tilted-slab"]')).toHaveCount(1)
    await expect(meshSelect.locator('option[value="angled-wedge"]')).toHaveCount(1)
  })

  test('clicking a genome row previews its rotation and shows a Follow best control', async ({ page }) => {
    await page.goto('/')

    const axisReadout = page.getByTestId('axis-readout')
    await expect(axisReadout).toBeVisible()

    const rows = page.getByTestId('genome-table').locator('tbody tr')
    await expect(rows.first()).toBeVisible()

    // Find a row whose Euler angles are not all 0.0 (i.e. a genuinely different rotation).
    const rowCount = await rows.count()
    let targetIndex = -1
    for (let i = 0; i < rowCount; i++) {
      const eulerText = (await rows.nth(i).locator('td').nth(3).textContent()) ?? ''
      if (eulerText.trim() !== '0.0, 0.0, 0.0') {
        targetIndex = i
        break
      }
    }
    expect(targetIndex).toBeGreaterThanOrEqual(0)

    const targetRow = rows.nth(targetIndex)
    const eulerText = (await targetRow.locator('td').nth(3).textContent()) ?? ''
    const [ex, ey, ez] = eulerText.split(',').map((s) => s.trim())

    // Click the row's index cell rather than the row itself: the quaternion and Euler
    // cells are now individually clickable to copy their raw values (stopping
    // propagation so a copy click doesn't also reselect the row), so a click at the
    // row's arbitrary center could otherwise land on one of those and no-op here.
    await targetRow.locator('td').first().click()
    await expect(targetRow).toHaveAttribute('data-selected', 'true')

    // The viewer's status line should switch from "Best score" to "Selected score",
    // and a "Follow best" control should appear to clear the selection.
    await expect(page.getByTestId('viewer-status')).toContainText('Selected score')
    const followBestButton = page.getByRole('button', { name: 'Follow best' })
    await expect(followBestButton).toBeVisible()

    // The axis readout should match the selected genome's Euler angles.
    await expect(axisReadout).toContainText(`X ${ex}°`)
    await expect(axisReadout).toContainText(`Y ${ey}°`)
    await expect(axisReadout).toContainText(`Z ${ez}°`)

    await followBestButton.click()
    await expect(followBestButton).toHaveCount(0)
    await expect(page.getByTestId('viewer-status')).toContainText('Best score')
  })
})
