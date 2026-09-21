# Sicherheitswartung

Stand: 21.09.2026

## Zugangsdaten

Die frühere Datei `data/twitch-token.json` enthielt einen öffentlich zugänglichen App-Token. Sie ist jetzt leer, wird von GitHub Pages ausgeschlossen und darf nie wieder Zugangsdaten enthalten. Die leere Datei bleibt als ungefährlicher Ersatz im Repository. Frühere Tokens können weiterhin im Git-Verlauf und in Kopien vorhanden sein; sie müssen beim Herausgeber widerrufen werden. Das Leeren der Datei allein macht sie nicht ungültig.

Die Secrets `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` und `FACEIT_API_KEY` gehören ausschließlich in die Repository-Secrets. Der Twitch-Lauf erzeugt einen kurzlebig verwendeten Token, fragt den öffentlichen Stream-Status ab und widerruft den Token anschließend. Nur Kanalname, Zuschauerzahl und Abrufzeit werden veröffentlicht. Kein Token wird in Dateien oder Cache geschrieben.

## Browser

Alle elf HTML-Seiten besitzen eine Content Security Policy. Ausführbares Inline-JavaScript und Inline-Eventhandler sind entfernt. Dynamische Texte werden HTML-escaped; dynamische Linkziele werden zusätzlich auf zulässige URL-Protokolle und fehlende Zugangsdaten geprüft. JSON-Daten bleiben grundsätzlich nicht vertrauenswürdig.

Öffentliche CORS-Relays sind entfernt. FACEIT wird bei Bedarf direkt angefragt, DACHCS und YouTube werden serverseitig für öffentliche JSON-Dateien gesammelt. Bei ausgefallenen Datenquellen bleiben vorhandene Daten bestehen. Twitch-Status älter als 45 Minuten wird als unbekannt angezeigt. Der Status wird ungefähr alle 15 Minuten aktualisiert; GitHub-Scheduling und Pages-Caches können weitere Verzögerung verursachen.

## Hosting und Repository

Bei der externen Prüfung funktionierten HTTPS, HSTS und die HTTP-zu-HTTPS-Weiterleitung. `.env` und `.git/config` antworteten mit 404. Zusätzliche Header wie `X-Content-Type-Options: nosniff`, `Permissions-Policy` und `Content-Security-Policy: frame-ancestors 'none'` müssen auf Hosting-/Proxy-Ebene gesetzt werden. Eine HTML-Meta-Regel kann `frame-ancestors` nicht ersetzen. GitHub Pages bietet hierfür keine projektspezifische Header-Datei. Eine `_headers`-Datei oder `.htaccess` würde hier keinen Schutz schaffen.

Der öffentlich abgefragte `main`-Branch war nicht geschützt. Branch-Regeln, 2FA, Berechtigungen von Mitwirkenden, Domain-/DNS-Zugriff und Secret-Rotation müssen im jeweiligen Konto geprüft werden. Branch-Regeln müssen die vorgesehenen Daten-Updates berücksichtigen. Kontozugriffe wurden nicht verändert.

Workflows verwenden festgeschriebene Action-Commits, begrenzte Laufzeiten und gemeinsame Sperren gegen konkurrierende Daten-Pushes. Schreibrechte liegen nur im jeweiligen Update-Job; Git-Zugangsdaten werden nicht im Checkout gespeichert. Ein expliziter Pages-Build stellt sicher, dass Bot-Updates veröffentlicht werden.

## Prüfung

`node --test tests/security.test.mjs` prüft gefährliche Links, HTML-/Attribut-Injektionen, Browser-Richtlinien und die Token-Behandlung einschließlich Fehlerfällen. Zusätzliche Browserprüfungen sollten nach Änderungen an Renderern, Skript-Tags oder der Content Security Policy erfolgen.

Eine Quellcode- und Browserprüfung ist keine Garantie, dass keinerlei weitere Sicherheitslücken existieren. Es gibt in diesem Repository keinen eigenen Login, keine Datenbank und keinen Anwendungsserver; externe Plattformen und Konten sind nicht vollständig durch diese Prüfung abgedeckt.

Referenzen:
- https://dev.twitch.tv/docs/authentication/revoke-tokens/
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
