# JGTrack – Architektur & Meilensteine

## Technik
- Three.js r160 (lokal in `vendor/`), ES-Module, kein Build-Schritt, statisch hostbar (GitHub Pages).
- Feste Physik-Schrittweite 1/120 s → reproduzierbare Zeiten (Basis für spätere Ghosts).
- Eigene Arcade-Fahrphysik statt Physik-Engine: volle 3D-Orientierung (Vorwärts-/Hochachse),
  Bodenabfrage per Raycast entlang der Fahrzeug-Hochachse → Loopings und Steilkurven möglich.
- Audio komplett synthetisch über WebAudio (keine fremden Assets).

## Module
| Ordner | Verantwortung |
|---|---|
| `js/track/layout.js` | Strecken-Code → Bausteine auf Gitter (ohne Three.js, in Node testbar) |
| `js/track/geometry.js` | Mittellinien/Oberflächen je Bausteintyp |
| `js/track/track.js` | Meshes, Kollisionsabfragen, Checkpoints, Ideallinie |
| `js/track/tracks.js` | Streckendaten (Code, Wände, Thema, Medaillenzeiten) |
| `js/track/environment.js` | Himmel, Meer, Inseln, Wolken, Licht |
| `js/vehicle/` | Fahrphysik (`car-physics.js`) und Modell (`car-model.js`) |
| `js/input/input.js` | Tastatur, Touch, Gamepad → einheitliche Steuerwerte |
| `js/audio/audio.js` | Motor, Reifen, Wind + Einmal-Sounds (Registry) |
| `js/render/` | Renderer, Kamera, Partikel |
| `js/ui/ui.js` | HUD, Countdown, Pause, Ziel, Menü |
| `js/game/` | Zustandsautomat, Bestenliste, Autopilot (Tests/Demo) |

## Meilensteine
1. **Prototyp** – Szene, Strecke, Auto, Kamera, Timer, Neustart, Reset bei Absturz. ✅
2. **Rennen** – Checkpoints, Countdown, Zielerkennung, Bestzeiten, 3D-Physik mit Drift.
3. **Streckenelemente** – Rampen, Sprünge, Steilkurven, Loopings, Wände, komplexere Layouts.
4. **Politur** – Sound, Partikel, Kamera (FOV/Shake), Pause-Menü, UI, Performance.
5. **Inhalt** – mehrere Strecken, Auswahlmenü, lokale Bestenliste, Medaillen, Freischalten.

Jeder Meilenstein wird mit einem Autopiloten im Headless-Browser durchgefahren (`tests/`).
