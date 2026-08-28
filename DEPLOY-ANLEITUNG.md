# Deployen — wie es jetzt läuft

Stand: 28.08.2026

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

## Wichtig: zwei Dateien hatten lokal gefehlt

Im Repo lagen `CNAME` und `data/twitch-token.json`, in deinem Ordner nicht.
Beide sind jetzt wiederhergestellt.

- **`CNAME`** enthält `donuts-esports.de`. Ohne die Datei verliert GitHub Pages
  die eigene Domain. Niemals löschen.
- **`data/twitch-token.json`** wird täglich vom Workflow neu geschrieben und treibt
  den Live-Banner. Nicht von Hand bearbeiten.

Beide werden von den GitHub Actions automatisch gepflegt. Wenn `git status` sie als
geändert anzeigt: einfach mit `git checkout -- <datei>` verwerfen, nicht committen.

## Was automatisch läuft

| Workflow | Wann | Was |
|---|---|---|
| `update-stats.yml` | täglich 08:00 + 20:00 | `scraper.js` → `data/stats.json` |
| `update-twitch-token.yml` | täglich 07:30 | frischer Twitch-App-Token |

Beide committen selbst ins Repo. Deshalb: **vor dem Arbeiten `git pull`**,
sonst kollidiert dein Commit mit dem des Bots.

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
