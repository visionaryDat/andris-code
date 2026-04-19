/// <reference types="node" />
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Credentials & URLs – loaded from .env via playwright.config.ts
// ---------------------------------------------------------------------------
const USERNAME = process.env.LN_USERNAME!;
const PASSWORD = process.env.LN_PASSWORD!;
const LOGIN_URL = process.env.LN_LOGIN_URL!;
const AUFTRAGSVORSCHLAEGE_URL = process.env.LN_AUFTRAGSVORSCHLAEGE_URL!;

const AUFTRAGSNUMMER_FILE = path.join(process.cwd(), 'test-results', 'produktionsauftragsnummer.json');

const PLANCODE = '100';
const NUMMERKREIS = '11';
const GERAET = 'D';

test.use({
  ignoreHTTPSErrors: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Vienna',
  acceptDownloads: true,
  headless: false,
  launchOptions: {
    args: [
      '--disable-features=Translate',
      '--disable-translate',
      '--lang=de-DE',
    ],
  },
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Gibt den Content Frame des Infor-LN-Hauptiframes zurück */
function ln(page: Page) {
  return page
    .locator('iframe[name="LN_e484c00e-5d9e-43fd-99fd-341a92005c1e"]')
    .contentFrame();
}

/** Schritt 1 & 2: Login + Firma 8300 auswählen */
async function loginAndSelectFirma8300(page: Page) {
  await page.goto(LOGIN_URL);
  await page.getByRole('textbox', { name: 'Username' }).fill(USERNAME);
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.locator('button[title="Anmelden"]').click();

  const firma8300 = ln(page).getByText('8300');
  await expect(firma8300).toBeVisible({ timeout: 30_000 });
  await firma8300.dblclick();

  // Startbildschirm laden
  await expect(ln(page).locator('#application-navigation-tree')).toBeVisible({ timeout: 30_000 });
}

/** Schritt 5: Ersten Artikel wählen und "Auftragsplanung übertragen" Dialog öffnen */
async function selectFirstArtikelAndOpenAuftragsplanungDialog(page: Page) {
  const ersterArtikelCheckbox = ln(page).locator(
    '#cprrp1100m000-grid-n1-select-n0 > .SvgIconDiv > #icon-checkbox-ln > .SvgCheckboxPartial'
  );

  const overflowButton = ln(page).locator('#cprrp1100m000-toolbar-left-REGULAR-overflowButton');
  const aktionenMenu = ln(page).getByRole('menuitem', { name: 'Aktionen' });
  const auftragsplanungMenuItem = ln(page).getByRole('menuitem', { name: 'Auftragsplanung übertragen...' });
  const nummerkreisField = ln(page).locator('[id="cppat1210m000-prod.ord.series-n48-lookup-widget"]');

  await expect(ersterArtikelCheckbox).toBeVisible({ timeout: 30_000 });
  await ersterArtikelCheckbox.click();

  await overflowButton.click();
  await aktionenMenu.click();
  await auftragsplanungMenuItem.click();

  // Sicherstellen dass der Dialog geöffnet ist 
  await expect(nummerkreisField).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// TEST 1: Anmeldung + Firma 8300 prüfen
// ---------------------------------------------------------------------------
test('Schritt 1 & 2 – Anmeldung bei InforLN und Prüfung Firma 8300', async ({ page }) => {
  test.setTimeout(120_000);

  await loginAndSelectFirma8300(page);
});

// ---------------------------------------------------------------------------
// TEST 2: Programm cprrp1100m000 ausführen, Plancode 100
// ---------------------------------------------------------------------------
test('Schritt 3 – Programm cprrp1100m000 mit Plancode 100 ausführen', async ({ page }) => {
  test.setTimeout(120_000);

  await loginAndSelectFirma8300(page);

  await test.step('Navigation zu C3 MIG Tool → Programm ausführen', async () => {
    const navTree = ln(page).locator('#application-navigation-tree');

    await ln(page).getByRole('treeitem', { name: 'C3 MIG Tool' }).click();
    await navTree.press('ArrowDown');
    await navTree.press('ArrowDown');
    await navTree.press('ArrowDown');
    await ln(page).locator('#node-options > .SvgIconDiv.tail > .icon').click();
    await navTree.press('ArrowDown');
    await navTree.press('Enter');
  });

  await test.step('Schritt 3 – Programm cprrp1100m000 eingeben (Lupe → Auswahl → OK)', async () => {
    const programEingabe = ln(page).locator('#dlg-run_program-input-control-widget-label');
    const programmEintrag = ln(page).getByRole('option', { name: 'cprrp1100m000' });
    const okButton = ln(page).getByRole('button', { name: 'OK' });
    const plancodeButton = ln(page).locator('[id="cprrp1100m000-cprrp100.plnc-lookup-trigger-button"]');

    await programEingabe.click();
    await programmEintrag.click();
    await okButton.click();

    await expect(plancodeButton).toBeVisible({ timeout: 30_000 });
  });

  await test.step('Plancode 100 über Lookup auswählen und Wert prüfen', async () => {
    const plancodeButton = ln(page).locator(
      '[id="cprrp1100m000-cprrp100.plnc-lookup-trigger-button"] > .SvgIconDiv > .icon'
    );
    const ersterPlancodEintrag = ln(page).locator(
      '#cprpd4100m000-grid-n1-select-n0 > .SvgIconDiv > #icon-checkbox-ln > .SvgCheckboxInside'
    );
    const saveAndCloseButton = ln(page).locator('[id="cprpd4100m000-button-std-file.save_and_close"]');
    const plancodeField = ln(page).locator('[id="cprrp1100m000-cprrp100.plnc-lookup-widget"]');

    await plancodeButton.click();
    await ersterPlancodEintrag.click();
    await saveAndCloseButton.click();

    await expect(plancodeField).toHaveValue(PLANCODE);
  });
});

// ---------------------------------------------------------------------------
// TEST 3: Artikel suchen, ersten Artikel auswählen, "Auftragsplanung übertragen" öffnen
// ---------------------------------------------------------------------------
test('Schritt 4 & 5 – Artikel auswählen und Auftragsplanung übertragen öffnen', async ({ page }) => {
  test.setTimeout(120_000);

  await loginAndSelectFirma8300(page);
  await page.goto(AUFTRAGSVORSCHLAEGE_URL);

  await test.step('Schritt 4 – Suchmaske öffnen und Ergebnisliste prüfen', async () => {
    const findButton = ln(page).locator(
      '[id="cprrp1100m000-button-std-edit.find-button"] > .SvgIconDiv > .icon'
    );
    const saveAndCloseButton = ln(page).locator(
      '[id="cprrp1100m000-button-std-file.save_and_close"].TextButton'
    );
    const ersterArtikel = ln(page).locator('#cprrp1100m000-grid-n1-select-n0');

    await findButton.click();
    // TODO: Artikelnummer in Suchfeld eingeben sobald Feld-ID bekannt ist
    await saveAndCloseButton.click();

    await expect(ersterArtikel).toBeVisible({ timeout: 30_000 });
  });

  await test.step('Schritt 5 – Ersten Artikel auswählen und Dialog prüfen', async () => {
    await selectFirstArtikelAndOpenAuftragsplanungDialog(page);
  });
});

// ---------------------------------------------------------------------------
// TEST 4: Nummerkreis 11, Gerät D, Weiter → Ausgabedokument + Auftragsnummer
// ---------------------------------------------------------------------------
test('Schritt 6 & 7 – Auftragsplanung übertragen und Ausgabedokument prüfen', async ({ page }) => {
  test.setTimeout(120_000);

  await loginAndSelectFirma8300(page);
  await page.goto(AUFTRAGSVORSCHLAEGE_URL);
  await selectFirstArtikelAndOpenAuftragsplanungDialog(page);

  await test.step('Schritt 6 – Nummerkreis 11 eingeben, Gerät D wählen, Weiter klicken', async () => {
    const nummerkreisField = ln(page).locator('[id="cppat1210m000-prod.ord.series-n48-lookup-widget"]');
    const geraetField = ln(page).locator('#ttstpsplopen-devc-n1-lookup-widget');
    const weiterButton = ln(page).getByRole('button', { name: 'Weiter' });

    await nummerkreisField.click();
    await nummerkreisField.fill(NUMMERKREIS);
    await nummerkreisField.press('Enter');

    await geraetField.press('CapsLock');
    await geraetField.fill(GERAET);

    await weiterButton.click();
  });

  await test.step('Schritt 7 – Ausgabedokument prüfen und Produktionsauftragsnummer erfassen', async () => {
    // TODO: Selektor auf das konkrete Ausgabedokument-Element anpassen
    // sobald der DOM-Aufbau der Ausgabeseite nach "Weiter" bekannt ist.
    const ausgabeNummer = ln(page).locator('[id="cppat1210m000-result-prod-ord-number"]');

    await expect(ausgabeNummer).toBeVisible({ timeout: 60_000 });

    const auftragsnummer = (await ausgabeNummer.textContent()) ?? '';

    expect(
      auftragsnummer.match(/^\d{6,}$/),
      `Ungültige Produktionsauftragsnummer: "${auftragsnummer}"`
    ).toBeTruthy();

    console.log(`✅ Produktionsauftragsnummer erfasst: ${auftragsnummer}`);

    fs.mkdirSync(path.dirname(AUFTRAGSNUMMER_FILE), { recursive: true });
    fs.writeFileSync(
      AUFTRAGSNUMMER_FILE,
      JSON.stringify({ produktionsauftragsnummer: auftragsnummer }, null, 2),
      'utf-8'
    );
    console.log(`💾 Nummer gespeichert: ${AUFTRAGSNUMMER_FILE}`);
  });
});




