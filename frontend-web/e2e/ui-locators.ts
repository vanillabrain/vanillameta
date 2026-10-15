import { expect, Locator, Page } from '@playwright/test';

/**
 * Locator contracts for the shadcn/Tailwind UI.
 *
 * The e2e/ and qa/ suites must not depend on styling libraries (MUI, Toast UI) or on their
 * generated class names. They use accessible roles/labels and the shadcn data-slot attributes:
 *  - shared fields render [data-slot=field] (role=group) with [data-slot=field-label] bound to the control;
 *  - selects are real native select elements (role=combobox, drive them with selectOption) or Radix
 *    combobox triggers (drive them with a click plus a named option);
 *  - data grids render [data-slot=datagrid] wrapping a real table;
 *  - dialogs are Radix role=dialog / role=alertdialog, and the shared alert template exposes
 *    [data-slot=alert-dialog-action] / [data-slot=alert-dialog-cancel] with plain language labels;
 *  - inline notices render [data-slot=alert][data-severity=...].
 */

/** Dismissal labels on the shared alert dialog: Cancel in en, plus defensive localized/close variants. */
const DISMISS = /^(Cancel|취소|Close|닫기|Dismiss)$/;

const normalize = (value: string) => value.split(/\s+/).join(' ').trim();

function labelPattern(label: string) {
  const escaped = label.replace(/[.*+?^$|{}()[\]\\]/g, character => '\\' + character);
  return new RegExp('^' + escaped + '(?: *[*])?$');
}

function matches(actual: string, expected: string | RegExp) {
  const value = normalize(actual);
  return expected instanceof RegExp ? expected.test(value) : value === expected;
}

/**
 * The shared confirmation template is a Radix AlertDialog. General Radix Dialogs also carry
 * aria-describedby, so that attribute must not be used to classify a confirmation.
 */
export const alertDialog = (page: Page) => page.locator('[role="alertdialog"]');

/** Accept or dismiss the shared confirmation/alert dialog by its named action, never by button order. */
export async function confirmDialog(page: Page, accept = true) {
  const box = alertDialog(page).last();
  await expect(box).toBeVisible();
  if (!accept) {
    const cancel = box.locator('[data-slot="alert-dialog-cancel"]');
    if (await cancel.count()) await cancel.click();
    else await box.getByRole('button', { name: DISMISS }).last().click();
  } else {
    const action = box.locator('[data-slot="alert-dialog-action"]');
    const primary = (await action.count()) ? action.first() : box.getByRole('button').filter({ hasNotText: DISMISS }).last();
    await expect(primary).toBeVisible();
    await primary.click();
  }
  await expect(alertDialog(page)).toHaveCount(0);
}

/** Dismiss an informational or error alert (single acknowledgement button). */
export async function dismissDialog(page: Page) {
  const box = alertDialog(page).last();
  await expect(box).toBeVisible();
  const named = box.locator('[data-slot="alert-dialog-action"], [data-slot="alert-dialog-cancel"]');
  if (await named.count()) await named.first().click();
  else await box.getByRole('button').last().click();
  await expect(alertDialog(page)).toHaveCount(0);
}

const isNativeSelect = (target: Locator) => target.evaluate(element => element.tagName.toLowerCase() === 'select');

const selectedText = (target: Locator) =>
  target.evaluate((element: HTMLSelectElement) => element.selectedOptions?.[0]?.textContent?.trim() ?? '');

/** Assert the displayed value of a native select or of a Radix combobox trigger. */
export async function expectSelected(target: Locator, value: string | RegExp) {
  if (await isNativeSelect(target)) {
    if (typeof value === 'string') await expect.poll(() => selectedText(target)).toBe(value);
    else await expect.poll(() => selectedText(target)).toMatch(value);
  } else await expect(target).toHaveText(value);
}

/** Choose an option on a native select or a Radix combobox trigger, then verify the visible value. */
export async function selectControl(page: Page, target: Locator, value: string | RegExp) {
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  if (await isNativeSelect(target)) {
    const labels = (await target.locator('option').allInnerTexts()).map(normalize);
    const index = labels.findIndex(label => matches(label, value));
    expect(index, 'select must offer ' + value + ' (options: ' + labels.join(' | ') + ')').toBeGreaterThanOrEqual(0);
    await target.selectOption({ index });
  } else {
    await target.click();
    await page.getByRole('option', { name: value, exact: typeof value === 'string' }).click();
  }
  await expectSelected(target, value);
}

/**
 * Combobox named by its visible label. The shared TextField binds FieldLabel to the control, and
 * components/form/SelectForm binds its Label through aria-labelledby, so both resolve by name.
 */
export function fieldCombobox(page: Page, label: string | RegExp, scope: Page | Locator = page) {
  return scope.getByRole('combobox', { name: typeof label === 'string' ? labelPattern(label) : label });
}

export const datagrid = (page: Page) => page.locator('[data-slot="datagrid"]');
export const datagridTable = (page: Page) => datagrid(page).locator('table').first();
export const datagridRows = (page: Page) => datagrid(page).locator('tbody tr[data-row-key]');

export const datagridColumn = (page: Page, column: string) =>
  datagrid(page).locator('thead th[data-column-name="' + column + '"]');

/** Assert one cell of the shadcn data grid by row index, column name and exact text. */
export async function gridCell(page: Page, column: string, value: string, row = 0) {
  await expect(datagridTable(page)).toBeVisible();
  const cell = datagrid(page).locator('[data-row-key="' + row + '"] td[data-column-name="' + column + '"]');
  expect(await cell.count(), 'datagrid must expose a "' + column + '" cell in row ' + row).toBe(1);
  await expect(cell).toHaveText(value);
}

export const card = (page: Page) => page.locator('[data-slot="card"]');
export const pagination = (page: Page) => page.locator('[data-slot="pagination"]');
export const successNotice = (page: Page) => page.locator('[data-slot="alert"][data-severity="success"]');
export const popupSurface = (page: Page) => page.locator('[data-slot="popover-content"], [data-slot="dialog-content"]');
export const errorSurface = (page: Page) =>
  page.locator(
    '[data-slot="alert"][data-severity="error"], [data-slot="alert-dialog-description"], [data-slot="dialog-description"]',
  );

export const navLink = (page: Page, name: string) => page.getByRole('link', { name, exact: true });

/** Widget surface: the shadcn Card on viewer pages, the react-grid-layout tile on dashboards. */
export const widgetTile = (page: Page, title: string) =>
  page.locator('[data-slot="card"], .react-grid-item').filter({ hasText: title });

export const accountMenu = (page: Page) => page.getByRole('button', { name: 'Account menu', exact: true });
export const languageSelect = (page: Page) => page.getByRole('combobox', { name: /Language|언어/ });

/** Profile/dropdown entry: a Radix menuitem or a plain button with the same accessible name. */
export function menuItem(page: Page, name: string | RegExp) {
  return page.getByRole('menuitem', { name }).or(page.getByRole('button', { name }));
}

export const nextPage = (page: Page) =>
  page.getByRole('link', { name: 'Go to next page' }).or(page.getByRole('button', { name: 'Go to next page' }));
