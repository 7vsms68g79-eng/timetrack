# TimeTrack

Arbeitszeit, Überstunden und Urlaub im Blick – als Web-App, die auf dem iPhone wie eine normale App vom Home-Bildschirm startet (eigenes Sanduhr-Symbol, Vollbild, funktioniert auch offline).

## 1. Online stellen mit GitHub Pages (einmalig, ca. 5 Minuten)

1. Auf [github.com](https://github.com) anmelden (oder kostenloses Konto anlegen).
2. Oben rechts **+** → **New repository** → Name `timetrack`, Sichtbarkeit **Public** → **Create repository**.
   (Öffentlich ist nur der App-Code. Deine Arbeitszeiten liegen ausschließlich auf deinem iPhone.)
3. Auf der leeren Repository-Seite auf **uploading an existing file** klicken.
4. Im Finder den Ordner `TimeTrack` öffnen, **alles darin markieren** (`index.html`, `manifest.webmanifest`, `sw.js`, `README.md` und die Ordner `css`, `js`, `icons`, `tests`) und ins Browserfenster ziehen → **Commit changes**.
5. Im Repository **Settings** → **Pages** → bei *Source* „Deploy from a branch“, Branch **main**, Ordner **/ (root)** → **Save**.
6. Nach etwa einer Minute ist die App erreichbar unter
   `https://<dein-github-name>.github.io/timetrack/`

## 2. Aufs iPhone holen

1. Die Adresse in **Safari** öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. TimeTrack erscheint mit Sanduhr-Symbol auf dem Home-Bildschirm und startet im Vollbild.

Wichtig: Nutze danach immer das Symbol auf dem Home-Bildschirm. iOS speichert die Daten der installierten App getrennt vom Safari-Tab.

## Updates

Geänderte Dateien im Repository erneut hochladen (gleiche Namen überschreiben). Die App holt sich beim nächsten Start mit Internet automatisch die neue Version – deine Einträge bleiben erhalten.

## Daten & Backup

Alle Einträge bleiben lokal auf dem Gerät. Unter **Einstellungen → Backup exportieren** kannst du eine Sicherung (JSON) z. B. in der Dateien-App ablegen und später über **Backup importieren** wiederherstellen – auch auf einem neuen iPhone.

## So rechnet TimeTrack

| Situation | Wirkung auf das Überstunden-Konto |
|---|---|
| Mehr als das Soll gearbeitet | + Differenz |
| Weniger als das Soll gearbeitet | nichts – es wird nie abgezogen |
| Arbeit an einem freien Tag oder Feiertag | + komplette Arbeitszeit |
| Urlaubstag (nur ganze Tage, nur Arbeitstage) | zählt 8 h und macht den Tag frei; + Differenz zum Soll (Mo +4 h, Di/Do ±0) – in den Einstellungen anpassbar |
| „Überstunden anrechnen“ | − fehlende Soll-Zeit (freier Tag: volles Soll; teilweise gearbeitet: nur die Lücke) |

- **Wochenplan:** 20-h-Plan (Werkstudent): Mo 4:00 h, Di 8:00 h (+ 30 min Pause = 8:30 h Anwesenheit), Do 8:00 h (+ 30 min Pause). 40-h-Plan (Vollzeit): Mo–Fr je 8:00 h + 30 min Pause. Umschalten in den Einstellungen mit „Gilt ab“-Datum – Tage davor behalten ihren alten Plan, bisherige Überstunden bleiben unverändert. Ein Wechsel lässt sich per × wieder löschen.
- **Dark Mode:** Einstellungen → Darstellung → Aus / An / Auto (Auto folgt dem iPhone).
- **Urlaubsanspruch:** volle Beschäftigungsmonate × 1,5 Tage, Bruchteile ab 0,5 werden aufgerundet (§ 5 BUrlG). 2026: 3 × 1,5 = 4,5 → **5 Tage**, ab 2027: **18 Tage**. Übertrag/Korrektur je Jahr im Urlaub-Tab.
- **Feiertage:** gesetzliche Feiertage für Bremen (bundesweit + Reformationstag); dort gilt kein Soll. Bundesland in den Einstellungen wählbar.
- Alles lässt sich rückwirkend eintragen und mit **Rückgängig** zurücknehmen.

## Entwicklung

- Reines HTML/CSS/JavaScript, kein Build-Schritt.
- Rechenlogik: `js/core.js`, Oberfläche: `js/app.js`, Gestaltung: `css/app.css`.
- Tests: `node --test tests/`
- Lokal starten: `python3 -m http.server 8765` im Ordner, dann `http://localhost:8765` öffnen.
