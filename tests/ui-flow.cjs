// Bedienablauf wie ein Spieler: Menü -> Countdown -> Fahren -> Pause -> Neustart -> Ziel -> Nächste Strecke.
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:8123/';
const OUT = process.env.OUT || '.';
const assert = (c, msg) => { if (!c) { console.log('✗', msg); process.exitCode = 1; } else console.log('✓', msg); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  const st = () => page.evaluate(() => window.__jg.game.state);

  assert((await page.locator('.track-card:disabled').count()) === 6, 'Nur je erste Strecke (Sprint + Langstrecke) freigeschaltet');
  await page.locator('.track-card').first().click();
  assert((await st()) === 'countdown', 'Klick startet Countdown');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/countdown.png` });
  await page.waitForFunction(() => window.__jg.game.state === 'racing', null, { timeout: 8000 });
  assert(true, 'Countdown endet mit Rennen');

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  const v = await page.evaluate(() => window.__jg.game.physics.speed);
  await page.keyboard.up('KeyW');
  assert(v > 10, `Gas per Tastatur beschleunigt (${v.toFixed(1)} m/s)`);
  await page.screenshot({ path: `${OUT}/racing.png` });

  await page.keyboard.press('Escape');
  assert((await st()) === 'paused', 'Esc pausiert');
  const t1 = await page.evaluate(() => window.__jg.game.steps);
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => window.__jg.game.steps);
  assert(t1 === t2, 'Timer steht in der Pause');
  await page.screenshot({ path: `${OUT}/pause.png` });
  await page.click('#btn-resume');
  assert((await st()) === 'racing', 'Weiter-Button setzt fort');

  await page.keyboard.press('Enter');
  assert((await st()) === 'countdown', 'Enter startet sofort neu');
  assert((await page.evaluate(() => window.__jg.game.steps)) === 0, 'Timer zurückgesetzt');

  // Audio: alle Einmal-Sounds abspielen
  const audioOk = await page.evaluate(async () => {
    const a = window.__jg.game.audio;
    a.unlock();
    const { SOUNDS } = await import('./js/audio/audio.js');
    for (const k of Object.keys(SOUNDS)) a.play(k, { strength: 12 });
    a.update({ speedRatio: 0.8, throttle: 1, slip: 10, grounded: true, active: true });
    return !!a.ctx && a.ctx.state;
  });
  assert(audioOk === 'running', `AudioContext läuft (${audioOk})`);

  // Ziel per Autopilot, dann Ergebnis-Bildschirm und nächste Strecke
  await page.waitForFunction(() => window.__jg.game.state === 'racing', null, { timeout: 8000 });
  await page.evaluate(() => {
    const g = window.__jg.game; g.autoDrive = true;
    for (let s = 0; s < 120 * 120 && g.state === 'racing'; s++) g.step(1 / 120);
    g.autoDrive = false;
  });
  await page.waitForTimeout(500);
  assert(await page.isVisible('#finish'), 'Ziel-Bildschirm sichtbar');
  await page.screenshot({ path: `${OUT}/finish.png` });
  assert(await page.isVisible('#btn-next'), 'Nächste Strecke verfügbar');
  await page.click('#btn-next');
  assert((await page.evaluate(() => window.__jg.game.def.id)) === 'wolkenbogen', 'Zweite Strecke geladen');
  await page.click('#hud .icon-btn[data-action=pause]');
  await page.click('#btn-menu');
  assert((await page.locator('.track-card:disabled').count()) === 5, 'Zweite Strecke jetzt freigeschaltet');
  const best = await page.locator('.track-card').first().locator('.best').textContent();
  assert(/\d\d:\d\d\.\d{3}/.test(best), `Bestzeit im Menü (${best})`);

  // Tastatur-Bedienung im Menü
  await page.locator('.track-card').nth(1).focus();
  await page.keyboard.press('Enter');
  assert((await st()) === 'countdown', 'Menü per Tastatur (Enter) bedienbar');

  // iPad: Touch-Steuerung
  const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'] });
  const tp = await ctx.newPage();
  tp.on('pageerror', (e) => errors.push('iPad: ' + e.message));
  await tp.goto(URL, { waitUntil: 'networkidle' });
  await tp.locator('.track-card').first().tap();
  await tp.waitForFunction(() => window.__jg.game.state === 'racing', null, { timeout: 8000 });
  assert(await tp.isVisible('[data-action=throttle]'), 'Touch-Buttons sichtbar');
  // Gas-Button gedrückt halten (pointerdown ohne pointerup)
  await tp.evaluate(() => document.querySelector('[data-action=throttle]').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true, pointerType: 'touch' })));
  await tp.waitForTimeout(1200);
  await tp.evaluate(() => document.querySelector('[data-action=throttle]').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true, pointerType: 'touch' })));
  assert(!(await tp.evaluate(() => window.__jg.game.input.touch.throttle)), 'Loslassen beendet Gas');
  const tv = await tp.evaluate(() => window.__jg.game.physics.speed);
  assert(tv > 5, `Touch-Gas beschleunigt (${tv.toFixed(1)} m/s)`);
  await tp.screenshot({ path: `${OUT}/ipad.png` });

  assert(errors.length === 0, `Keine Konsolenfehler ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
})();
