/**
 * DD-116 – Sonderbedarf nach Artikel / Auftragsplanung generieren
 * Jira: https://sqf.atlassian.net/browse/DD-116
 *
 * Testziel:
 * Prüfen ob ein Sonderbedarf (Prognose) erfasst, in der Planungsübersicht
 * sichtbar und daraus ein Bestellvorschlag generiert werden kann.
 */

import { test, expect } from '@playwright/test';
import { login, ln } from '../helpers/inforln';
import { addDays, format } from '../helpers/dateUtils';

// ---------------------------------------------------------------------------
// Fachliche Konstanten
// ---------------------------------------------------------------------------
const PLANCODE            = '900';
const PLANCODE_LABEL      = 'Plancode Fa. 900';
const PLANARTIKEL_VON     = '100';
const PLANARTIKEL_BIS     = '10003';
const ARTIKEL_BEZEICHNUNG = 'Toner-Kassette grün';
const PROGNOSEMENGE       = '10';
const AUSGABEGERAET       = 'd';
const BEDARFSDATUM_INPUT  = '+20';

// ---------------------------------------------------------------------------
// Hilfsfunktion: Plancode-Feld im Formular cpdsp2100m000
// Das Feld hat keine stabile aria-label; nth(3) stammt aus dem Codegen-Recording
// und ist die zuverlässigste verfügbare Referenz für dieses Formular.
// ---------------------------------------------------------------------------
const plancodeField = (page: Parameters<typeof ln>[0]) =>
  ln(page).getByRole('textbox').nth(3);

// ---------------------------------------------------------------------------
// TEST
// ---------------------------------------------------------------------------
test('DD-116 – Sonderbedarf erfassen und Bestellvorschlag generieren', async ({ page }) => {
  test.setTimeout(180_000);

  await login(page);

  // -------------------------------------------------------------------------
  // Schritt 1 – Navigation: Planning → Order Planning → Sonderbedarf nach Artikel
  // -------------------------------------------------------------------------
  await test.step('Schritt 1 – Sonderbedarf nach Artikel öffnen', async () => {
    await ln(page).getByRole('treeitem', { name: 'Planning' }).click();
    await ln(page).getByRole('treeitem', { name: 'Order Planning' }).click();
    await ln(page).locator('#node-cpdsp2100m000-label').click();

    await expect(
      ln(page).locator('[id="cpdsp2100m000-button-std-group.new"]')
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 2 – "Neue Ansicht" klicken → Plancode-Feld wird aktiv
  // -------------------------------------------------------------------------
  await test.step('Schritt 2 – Neue Ansicht öffnen', async () => {
    await ln(page).locator('[id="cpdsp2100m000-button-std-group.new"]').click();

    await expect(plancodeField(page)).toBeEnabled({ timeout: 15_000 });
    await expect(plancodeField(page)).toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // Schritt 3 – Plancode "900" eingeben + Tab
  // Plancode 900 ist nicht direkt im Lookup vorhanden; InforLN zeigt einen
  // "Kein Datensatz gefunden"-Dialog, der mit Enter bestätigt werden muss.
  // -------------------------------------------------------------------------
  await test.step('Schritt 3 – Plancode 900 eingeben und Label prüfen', async () => {
    await plancodeField(page).fill(PLANCODE);
    await plancodeField(page).press('Tab');

    // Dialog "Kein Datensatz gefunden" tritt immer auf → mit Enter bestätigen
    await ln(page).locator('#dlg-cpdsp2100m000-input-button-n0').press('Enter');

    await expect(ln(page).getByText(PLANCODE_LABEL)).toBeVisible({ timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 4 – Planartikel Von / Bis eingeben
  // Die Felder haben keine stabilen IDs; sie folgen direkt nach dem
  // Plancode-Feld in der Tab-Reihenfolge des Formulars.
  // -------------------------------------------------------------------------
  await test.step('Schritt 4 – Planartikel Von und Bis eingeben', async () => {
    // Von-Feld: ein Tab nach dem Plancode-Feld
    await plancodeField(page).press('Tab');
    await ln(page).getByRole('textbox').nth(4).fill(PLANARTIKEL_VON);
    await ln(page).getByRole('textbox').nth(4).press('Tab');

    // Bis-Feld: zwei Tabs nach dem Von-Feld (ein Zwischenfeld wird übersprungen)
    await ln(page).getByRole('textbox').nth(5).fill(PLANARTIKEL_BIS);
    await ln(page).getByRole('textbox').nth(5).press('Tab');

    await expect(ln(page).getByText(ARTIKEL_BEZEICHNUNG)).toBeVisible({ timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 5 – "Hinzufügen" klicken → neue Prognosezeile wird erstellt
  // -------------------------------------------------------------------------
  await test.step('Schritt 5 – Neue Prognosezeile hinzufügen', async () => {
    await ln(page).getByRole('button', { name: 'Add' }).click();

    const bedarfsdatumField = ln(page).locator('[id*="cpdsp2100m000"][id*="req.date"]').first();
    const today = format(new Date(), 'dd.MM.yyyy');

    // Bedarfsdatum wird mit aktuellem Datum vorbelegt
    await expect(bedarfsdatumField).toHaveValue(today, { timeout: 15_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 6 – Bedarfsdatum "+20" eingeben → Datum in 20 Tagen
  // -------------------------------------------------------------------------
  await test.step('Schritt 6 – Bedarfsdatum auf heute + 20 Tage setzen', async () => {
    const bedarfsdatumField = ln(page).locator('[id*="cpdsp2100m000"][id*="req.date"]').first();
    const expectedDate      = format(addDays(new Date(), 20), 'dd.MM.yyyy');

    await bedarfsdatumField.fill(BEDARFSDATUM_INPUT);
    await bedarfsdatumField.press('Tab');

    await expect(bedarfsdatumField).toHaveValue(expectedDate);
  });

  // -------------------------------------------------------------------------
  // Schritt 7 – Prognosemenge eingeben und speichern
  // -------------------------------------------------------------------------
  await test.step('Schritt 7 – Prognosemenge 10 eingeben und speichern', async () => {
    const prognosemengeField = ln(page).locator('[id*="cpdsp2100m000"][id*="fcst.qty"]').first();

    await prognosemengeField.fill(PROGNOSEMENGE);
    await prognosemengeField.press('Tab');

    await ln(page).getByRole('button', { name: 'Save' }).click();

    // Kein Fehler-Dialog darf erscheinen
    await expect(ln(page).locator('#sysmesdialog-button-n0')).not.toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 8 – Zeitbezogene Planungsübersicht öffnen
  // -------------------------------------------------------------------------
  await test.step('Schritt 8 – Zeitbezogene Planungsübersicht öffnen', async () => {
    await ln(page).locator('#node-cppat1620m000-label').click();

    await expect(
      ln(page).getByRole('dialog', { name: 'Time-Phased Planning Overview' })
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 9 – Dialog filtern: Plancode, Planartikel, Periodenlänge setzen
  // -------------------------------------------------------------------------
  await test.step('Schritt 9 – Planungsübersicht filtern und Prognose prüfen', async () => {
    await plancodeField(page).fill(PLANCODE);
    await plancodeField(page).press('Tab');

    // Lookup-Dialog für Plancode bestätigen
    await ln(page).locator('#dlg-cpdsp2100m000-input-button-n0').press('Enter');

    await ln(page).getByRole('textbox').nth(4).fill(PLANARTIKEL_VON);
    await ln(page).getByRole('textbox').nth(4).press('Tab');
    await ln(page).getByRole('textbox').nth(5).fill(PLANARTIKEL_BIS);
    await ln(page).getByRole('textbox').nth(5).press('Tab');

    await ln(page).getByRole('combobox', { name: 'Period Length' }).selectOption('Dates');

    const hideEmptyCheck = ln(page).getByRole('checkbox', { name: 'Hide Empty Periods' });
    await hideEmptyCheck.check();
    await expect(hideEmptyCheck).toBeChecked();

    await ln(page).getByRole('button', { name: 'OK' }).click();

    // Prognosezeile mit Menge 10 muss sichtbar sein
    await expect(ln(page).getByText(PROGNOSEMENGE)).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 10 – Prognosezeile markieren und "Aufträge generieren" klicken
  // -------------------------------------------------------------------------
  await test.step('Schritt 10 – Prognose markieren und Aufträge generieren', async () => {
    const prognoseRow = ln(page).getByRole('row').filter({ hasText: PROGNOSEMENGE }).first();
    await prognoseRow.getByRole('checkbox').check();
    await expect(prognoseRow.getByRole('checkbox')).toBeChecked();

    await ln(page).getByRole('button', { name: 'Generate Orders' }).click();

    await expect(
      ln(page).getByRole('dialog', { name: 'Order Planning - Generate' })
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 11 – Optionen im "Generate"-Dialog aktivieren und starten
  // -------------------------------------------------------------------------
  await test.step('Schritt 11 – Optionen markieren und Generieren klicken', async () => {
    const bedarfsverursacherCheck = ln(page).getByRole('checkbox', { name: 'Update Demand Pegging' });
    const hauptressourcenCheck    = ln(page).getByRole('checkbox', { name: 'Update MRP' });

    await bedarfsverursacherCheck.check();
    await expect(bedarfsverursacherCheck).toBeChecked();

    await hauptressourcenCheck.check();
    await expect(hauptressourcenCheck).toBeChecked();

    await ln(page).getByRole('button', { name: 'Generate' }).click();

    await expect(ln(page).locator('#ttstpsplopen-devc-n1-lookup-widget')).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 12 – Ausgabegerät "d" eingeben und Weiter
  // -------------------------------------------------------------------------
  await test.step('Schritt 12 – Ausgabegerät "d" eingeben und Weiter klicken', async () => {
    const ausgabegeraetField = ln(page).locator('#ttstpsplopen-devc-n1-lookup-widget');

    await ausgabegeraetField.fill(AUSGABEGERAET);
    await ausgabegeraetField.press('Tab');
    await ln(page).getByRole('button', { name: 'Continue' }).click();

    await expect(
      ln(page).getByRole('dialog', { name: 'Order Planning - Generate' })
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Schritt 13 – OK klicken → Bestellvorschlag erscheint über der Prognose
  // -------------------------------------------------------------------------
  await test.step('Schritt 13 – OK klicken und Bestellvorschlag prüfen', async () => {
    await ln(page).getByRole('button', { name: 'OK' }).click();

    const planungsGrid = ln(page).getByRole('grid');

    // Planungsübersicht ist wieder sichtbar
    await expect(planungsGrid).toBeVisible({ timeout: 60_000 });

    // Mindestens 2 Datenzeilen → Bestellvorschlag wurde über der Prognose eingefügt
    const dataRows = planungsGrid.getByRole('row').filter({ hasNot: planungsGrid.getByRole('columnheader') });
    await expect(dataRows).toHaveCount(2, { timeout: 30_000 });
  });
});
