# Deployen — wie es jetzt läuft

Stand: 21.09.2026

## Kurzfassung

Der Ordner `G:\Donuts-Website` ist jetzt eine **echte Git-Arbeitskopie** des Repos
`TubeY0u/donuts-esports-website`. Kein Datei-Hochladen im Browser mehr.

```powershell
cd G:\Donuts-Website
git status                 # zeigt, was sich geändert hat
git add -A
git commit -m "Roster-Seiten, Live-Ticker, Partner-Sektion"
git push
```

Beim ersten `git push` fragt Windows nach deinem GitHub-Login. Danach merkt es sich das.
GitHub Pages baut die Seite anschließend automatisch neu (dauert ein bis zwei Minuten).

## Sicherheitsänderung vom 21.09.2026

- `CNAME` muss weiterhin `donuts-esports.de` enthalten.
- `data/twitch-token.json` ist absichtlich leer und vom Pages-Build ausgeschlossen. Hier niemals Zugangsdaten eintragen oder alte Inhalte wiederherstellen.
- Twitch-Secrets bleiben ausschließlich in GitHub Actions. Der Workflow veröffentlicht nur `data/twitch-status.json`; den verwendeten Token widerruft er anschließend.
- Bereits veröffentlichte Tokens müssen gesondert widerrufen werden; siehe `SECURITY.md`.

## Was automatisch läuft

| Workflow | Wann | Was |
|---|---|---|
| `update-stats.yml` | täglich 06:00 + 18:00 UTC | Statistiken und YouTube-Metadaten |
| `update-twitch-token.yml` (historischer Dateiname) | ungefähr alle 15 Minuten | öffentlicher Twitch-Status, keine Tokens |

Beide committen ausschließlich öffentliche Daten und fordern anschließend einen Pages-Build an. Twitch-Status kann wegen Scheduling und Cache verzögert erscheinen; veraltete Daten werden als unbekannt angezeigt.

Vor Änderungen den aktuellen Repository-Stand abgleichen. Sicherheitsprüfung: `node --test tests/security.test.mjs`.

## Was du wo pflegst

| Was | Datei |
|---|---|
| Highlights-Timeline auf der Startseite | `data/history.json` |
| Partner / Sponsoren | `data/partners.json` (leer = Sektion ausgeblendet) |
| Team-Texte und Spielerkarten | `roster/main/`, `roster/nxt/`, `roster/dns/` |
| Zusätzliche Matches (Showmatches) | `js/main.js`, Konstante `MATCHES` |
| Alles andere an Zahlen | gar nicht, kommt aus `data/stats.json` |

## Wenn sich eine Aufstellung aendert

Die Spielerkarten stehen fest im HTML der jeweiligen Team-Seite. Standins tragen
dort die Klasse `player--standin` und zaehlen nicht zur Aufstellung.

Die Uebersicht unter `/roster/` zeigt genau die fuenf Startspieler. Welche das
sind, steht als `data-lineup` an der jeweiligen `.tc-card` in
`roster/index.html`, mit Nickname, Bildpfad und Initialen. Wenn du auf einer
Team-Seite jemanden austauschst, musst du diese Liste mit anpassen, sonst zeigt
die Uebersicht noch die alte Aufstellung.

Der Nickname darin muss exakt dem `data-nickname` der Spielerkarte entsprechen,
sonst findet die Uebersicht die ELO nicht.

## Offener Punkt: K/R und ADR

`scraper.js` fragt bei FACEIT `Average K/R Ratio` und `Average Damage per Round` ab.
Die CS2-Lifetime-Statistik der v4-API liefert diese beiden Felder nicht — sie kommen
als `null` an. Auf den Spielerkarten steht deshalb `—` statt einer Zahl.

Vorher standen dort feste Werte im HTML, die aus dem Mai stammten und sich nie
aktualisiert haben. Falsche Zahlen sind schlechter als keine, deshalb jetzt `—`.

Zum Reparieren müsste der Scraper die Werte aus einem anderen Endpoint holen
(z.B. `/players/{id}/games/cs2/stats` — die letzten Matches, daraus der Schnitt).
Das lässt sich nur mit gültigem `FACEIT_API_KEY` testen.
