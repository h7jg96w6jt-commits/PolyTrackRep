# JGTrack

Low-Poly-Zeitrennspiel im Browser. Three.js, ohne Build-Schritt.

## Spielen

- **Online:** über GitHub Pages (Settings → Pages → Branch `main`, Ordner `/ (root)`).
- **Lokal:** `npx http-server .` und `http://localhost:8080` öffnen (ein direktes Öffnen der Datei funktioniert wegen ES-Modulen nicht).

## Steuerung

| Aktion | Tastatur | Touch |
|---|---|---|
| Gas | W / ↑ | ▲ |
| Bremse / Rückwärts | S / ↓ | ▼ |
| Lenken | A D / ← → | ◀ ▶ |
| Zum letzten Checkpoint | R | ↺ |
| Neustart | Enter | ⟲ |

Die Zeit startet mit dem ersten Tastendruck. Alle Checkpoints müssen in Reihenfolge durchfahren werden. Die Bestzeit wird lokal im Browser gespeichert.

## Strecken bauen

Strecken stehen in `js/tracks.js` als Code aus Bausteinen:

| Code | Baustein |
|---|---|
| `B` | Start (muss zuerst kommen) |
| `F` | Ziel (muss zuletzt kommen) |
| `S` | Gerade |
| `C` | Checkpoint |
| `T` | Boost |
| `L` / `R` | Links- / Rechtskurve |
| `U` / `D` | Rampe hoch / runter |

Eine Zahl wiederholt den Baustein: `S3` = `SSS`. Bausteine dürfen sich nicht überlappen und nicht unter Ebene 0 führen, sonst zeigt die Konsole einen Fehler.

## Aufbau

```
index.html        Seite, HUD, Touch-Buttons
css/style.css     Layout
js/main.js        Spielablauf, Kamera, Zeitmessung, HUD
js/car.js         Auto-Modell und Fahrphysik
js/track.js       Streckengeometrie, Kulisse, Bodenabfrage
js/layout.js      Strecken-Code → Bausteinpositionen (ohne Three.js)
js/tracks.js      Strecken
js/input.js       Tastatur und Touch
vendor/           Three.js r160 (MIT)
```

Die Physik läuft mit festen 120 Schritten pro Sekunde, damit Zeiten reproduzierbar sind.
