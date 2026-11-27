# JGTrack

Arcade-Zeitrennen im Browser: ein kleines Auto, schwebende Strecken über dem Meer, Loopings, Sprünge und Steilkurven. Three.js, eigene Fahrphysik, alles synthetisch erzeugt (Grafik und Sound), kein Build-Schritt.

**Spielen:** https://h7jg96w6jt-commits.github.io/PolyTrackRep/ (GitHub Pages: Settings → Pages → Branch `main`, Ordner `/ (root)`)
**Lokal:** `npx http-server .` → `http://localhost:8080`

## Steuerung

| Aktion | Tastatur | Gamepad | Touch |
|---|---|---|---|
| Gas | W / ↑ | RT / A | ▲ |
| Bremse / Rückwärts | S / ↓ | LT / X | ▼ |
| Lenken | A D / ← → | linker Stick / Steuerkreuz | ◀ ▶ |
| Drift | Leertaste / Shift | B / Schultertasten | DRIFT |
| In der Luft | Gas/Bremse = Nicken, Lenken = Drehen | | |
| Zum letzten Checkpoint | R | Y | ↺ |
| Neustart | Enter / Backspace | Back | ⟲ |
| Pause | Esc / P | Start | ❚❚ |
| Ton an/aus | M | | 🔊 |

## Spielablauf

- Countdown 3-2-1, dann läuft die Zeit (feste 120 Physik-Schritte/s → exakte, reproduzierbare Zeiten).
- Checkpoints in Reihenfolge durchfahren; Zwischenzeit wird mit der eigenen Bestzeit verglichen.
- Wer von der Strecke fällt, startet am letzten Checkpoint neu (die Zeit läuft weiter).
- Ziel: Ergebnis, Medaille (Gold/Silber/Bronze) und lokale Top-5-Bestenliste.
- Strecken werden nacheinander freigeschaltet (vorherige Strecke beenden).

## Strecken bauen

Strecken stehen in `js/track/tracks.js` als Code. Neue Strecke = neuer Eintrag, die Engine bleibt unverändert.

| Code | Baustein | Felder |
|---|---|---|
| `B` / `F` | Start / Ziel | 1 |
| `S` | Gerade | 1 |
| `C` | Checkpoint | 1 |
| `T` | Boost | 1 |
| `L` / `R` | enge Kurve links/rechts | 1 |
| `l` / `r` | weite Kurve | 2×2 |
| `Q` / `E` | Steilkurve | 2×2 |
| `U` / `D` | Rampe hoch/runter (eine Ebene) | 1 |
| `J` | Sprung mit Lücke | 3 |
| `O` | Looping | 2 |

Zahl = Wiederholung (`S3`). Optionen pro Strecke: `walls` (`all`/`curves`/`none`), `medals`, `theme` (Streckenfarben), `env` (Himmel, Meer, Licht).
`node tests/validate-tracks.mjs` prüft Überlappungen, Ebenen, Start/Ziel, Checkpoints, Medaillen und Auslauf nach Sprüngen.

## Tests

```
npx http-server -p 8123 . &
node tests/validate-tracks.mjs   # Layout-Prüfung (ohne Browser)
node tests/e2e.cjs               # Autopilot fährt jede Strecke bis ins Ziel
node tests/ui-flow.cjs           # Menü, Countdown, Tastatur, Pause, Neustart, Ziel, Audio, iPad-Touch
```
Die Browser-Tests brauchen Playwright mit Chromium.

## Architektur

```
js/main.js               Renderer, Verdrahtung, Hauptschleife
js/game/game.js          Zustandsautomat (menu/countdown/racing/paused/finished), Zeitmessung
js/game/records.js       Bestenliste und Medaillen (localStorage)
js/game/autopilot.js     Ideallinien-Fahrer für Menü-Demo und Tests
js/vehicle/car-physics.js  Arcade-Physik mit 3D-Orientierung (Loopings), Drift, Luftsteuerung, Wände
js/vehicle/car-model.js  Low-Poly-Auto
js/track/layout.js       Strecken-Code → Bausteine auf Gitter (ohne Three.js)
js/track/geometry.js     Oberflächen je Bausteintyp
js/track/track.js        Meshes, Raycasts (räumlicher Index), Checkpoints, Ideallinie
js/track/environment.js  Himmel, Meer, Inseln, Wolken, Licht
js/track/tracks.js       Streckendaten
js/input/input.js        Tastatur, Touch, Gamepad → einheitliche Steuerwerte
js/audio/audio.js        WebAudio: Motor, Reifen, Wind + Sound-Registry
js/render/camera.js      Verfolgerkamera (FOV nach Tempo, Wackeln, Kollision)
js/render/particles.js   Partikel (Drift, Boost, Landung, Funken)
js/ui/ui.js              HUD, Countdown, Menü, Pause, Ziel
vendor/                  Three.js r160 (MIT)
```
Details und Meilensteine: `docs/PLAN.md`.
