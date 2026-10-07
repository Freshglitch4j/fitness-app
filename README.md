# Fitness

Ein schlichtes Trainingstagebuch als installierbare Web-App (PWA) – gebaut nach
dem Vorbild der Papierkarte: Übung, Gewicht, Satz 1 / 2 / 3. Alle Daten bleiben
auf deinem Handy. Kein Konto, kein Server, keine Werbung, offline nutzbar.

**Adresse der App:** <https://freshglitch4j.github.io/fitness-app/>

(Früher lag die App unter `…/fitness/`. Dort bleibt nichts mehr erreichbar; die Daten
sind trotzdem da, weil sie an `freshglitch4j.github.io` hängen, nicht am Ordner.)

---

## Teil 1 – Einmalige Einrichtung

### GitHub Pages einschalten (einmalig, am Computer oder Handy)

1. Auf GitHub das Repository **fitness-app** öffnen.
2. **Settings** → links **Pages**.
3. Bei „Build and deployment“ → „Source“: **Deploy from a branch**.
4. Bei „Branch“: **main** und **/ (root)** wählen → **Save**.
5. Ein bis zwei Minuten warten. Danach ist die App unter
   `https://freshglitch4j.github.io/fitness-app/` erreichbar.

### Auf den Startbildschirm des Galaxy A55

1. **Chrome** öffnen (nicht Samsung Internet) und die Adresse oben aufrufen.
2. Oben in der App auf **Installieren** im Kasten „Als App installieren“ tippen
   (gibt es auch unter *Einstellungen → App installieren*) und bestätigen.
   **Nicht** über das Chrome-Menü „Installieren und Verknüpfung erstellen“:
   Weil unter `freshglitch4j.github.io` schon andere Apps installiert sind,
   meldet dieser Dialog fälschlich „bereits installiert“.
3. Das Petrol-Symbol mit der Hantel erscheint auf dem Startbildschirm.
   Ab jetzt die App immer darüber öffnen – sie läuft dann wie eine normale App,
   ohne Adressleiste, und funktioniert auch ohne Internet.

---

## Teil 2 – Bedienung

Unten gibt es drei Bereiche: **Training**, **Analyse** und **Einstellungen**.

### Training erfassen

- Beim Öffnen siehst du das heutige Training mit seiner **laufenden Nummer**
  (Training 1, 2, 3 …). Datum und Uhrzeit werden automatisch gesetzt, sobald du
  den ersten Wert einträgst.
- Jede Übung hat eine Zeile wie auf der Papierkarte:
  **Gewicht · Satz 1 · Satz 2 · Satz 3 · +**
- **Graue Zahlen** sind die Werte vom letzten Mal. Feld antippen → das
  Zahlenfeld öffnet sich, schon mit dem letzten Wert vorbelegt.
  - **OK** übernimmt den Wert und springt direkt zum nächsten Satz.
  - Einfach eine neue Zahl tippen ersetzt den Vorschlag.
  - **− / +** ändern in Schritten: Gewicht 0,5 kg, Wiederholungen 1.
  - **,** erlaubt halbe Wiederholungen (z. B. 9,5).
  - **✓ ohne Zahl** hakt einen Satz ab, ohne Wiederholungen zu zählen
    (z. B. für Bauch, Nacken).
  - **Leeren** löscht den Wert.
- Nach dem ersten Satz übernimmt die App automatisch das Gewicht vom letzten Mal.
  Hat sich das Gewicht geändert, das Gewichtsfeld antippen und anpassen.
- **+** am Zeilenende fügt einen weiteren Satz hinzu (bis 6).
- **Notiz** speichert eine kurze Bemerkung zur Übung in diesem Training.
- **Körpergewicht** ganz oben ist freiwillig.
- Erledigte Übungen bekommen links einen Petrol-Streifen und ein ✓.

### Pausentimer

Nach jedem eingetragenen Satz startet unten ein Countdown (Standard 90 s). Am
Ende vibriert das Handy. **+30 s** verlängert, **✕** beendet. Dauer oder
Ausschalten unter *Einstellungen → Pausentimer*.
Hinweis: Android vibriert nur, solange die App im Vordergrund ist.

### Analyse

- Oben eine Übung wählen.
- **Diagramm:** Wiederholungen je Satz im Zeitverlauf – Satz 1, 2 und 3 als
  eigene Linien. Das Gewicht steht dezent unter der Zeitachse, jeweils dort, wo
  es sich geändert hat. Ins Diagramm tippen zeigt die genauen Werte eines
  Trainings.
- Zeitraum: 3 Monate, 6 Monate, 1 Jahr oder alles.
- Darunter der **Verlauf** als Liste. Einen Eintrag antippen öffnet das
  Training zum Bearbeiten.
- **Alle Trainings** zeigt jedes Training wie eine Papierkarte.
- **Körpergewicht** zeigt den Gewichtsverlauf.

### Übungen verwalten (Einstellungen)

- **+ Übung hinzufügen**: Name, Art (mit Gewicht / Körpergewicht) und
  Standard-Anzahl der Sätze.
- Übung antippen zum Bearbeiten. Dort:
  - **Ausblenden** – verschwindet aus dem Training, der Verlauf bleibt.
  - **Endgültig löschen** – entfernt die Übung samt Verlauf.
- Mit **↑ ↓** die Reihenfolge ändern.

### Früheres Training bearbeiten oder nachtragen

Über *Analyse* ein Training antippen, oder im Training oben rechts auf das
Kalendersymbol tippen und ein Datum wählen. **heute** führt zurück.
Ganz unten kann ein Training gelöscht werden.

---

## Teil 3 – Wo deine Daten liegen

Alles wird im Speicher von Chrome auf deinem Handy abgelegt. Es wird nichts
hochgeladen. Achtung: Wenn du in Chrome „Websitedaten löschen“ wählst oder die
App deinstallierst, sind die Daten weg – deshalb Backups machen.

## Teil 4 – Backup

*Einstellungen → Daten*

- **Backup speichern (JSON)** legt eine Datei im Ordner *Downloads* ab. Am
  besten danach in Google Drive oder per Mail an dich selbst sichern. Die App
  erinnert mit einem roten Punkt, wenn das letzte Backup älter als 30 Tage ist.
- **Backup einspielen** ersetzt die aktuellen Daten durch die Sicherung.
  Einmal danach lässt sich das mit **Letzten Import rückgängig machen** zurücknehmen.
- **Export für Excel (CSV)** – eine Zeile pro Übung und Training, Komma als
  Dezimaltrennzeichen, Semikolon als Spaltentrenner. Öffnet sich direkt
  richtig in deutschem Excel. Zum Zurückspielen immer die JSON-Datei verwenden.

## Teil 5 – Neues Handy

Auf dem alten Handy ein Backup speichern, die Datei aufs neue Handy bringen,
dort die App installieren und *Backup einspielen*.

## Teil 6 – Updates

Neue Versionen werden automatisch geladen, sobald die App mit Internet geöffnet
wird. Manchmal braucht es einen zweiten Start, bis die neue Version sichtbar ist.

---

## Technik

Reines HTML/CSS/JavaScript ohne Framework und ohne Build-Schritt.

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst der drei Bereiche |
| `styles.css` | Gestaltung (Dunkel/Hell, Petrol) |
| `core.js` | Logik ohne Oberfläche: Trainings, Nummerierung, Auswertung, CSV, Import |
| `app.js` | Bedienoberfläche, Zahlenfeld, Diagramm, Pausentimer |
| `sw.js` | Service Worker für Offline-Betrieb – bei Änderungen `VERSION` erhöhen |
| `manifest.webmanifest` | Angaben für die Installation |
