// Browser-Test: lädt das Spiel, prüft Fehler und lässt den Autopiloten jede Strecke fahren.
// Aufruf: npx http-server -p 8123 . & node tests/e2e.cjs  (Playwright muss installiert sein)
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8123/';
const OUT = process.env.OUT || '.';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/menu.png` });

  const count = await page.evaluate(() => window.__jg.game.constructor && document.querySelectorAll('.track-card').length);
  let ok = true;
  for (let i = 0; i < count; i++) {
    const res = await page.evaluate((i) => {
      const g = window.__jg.game;
      g.startRace(i);
      g.state = 'racing';
      g.autoDrive = true;
      let respawns = 0, wall = 0, land = 0, maxSpeed = 0;
      const orig = g.respawn.bind(g);
      g.respawn = () => { respawns++; orig(); };
      const STEP = 1 / 120;
      for (let s = 0; s < 120 * 180 && g.state === 'racing'; s++) {
        g.step(STEP);
        for (const e of g.physics.events) { if (e.type === 'wall') wall++; if (e.type === 'land') land++; }
        maxSpeed = Math.max(maxSpeed, g.physics.speed);
      }
      g.respawn = orig;
      g.autoDrive = false;
      return { name: g.def.name, state: g.state, time: g.lastResult?.time, cp: g.nextCp, cps: g.track.checkpoints.length, respawns, wall, land, maxKmh: Math.round(maxSpeed * 3.6) };
    }, i);
    console.log(JSON.stringify(res));
    if (res.state !== 'finished') ok = false;
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/finish-${i}.png` });
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(ok && !errors.length ? 0 : 1);
})();
