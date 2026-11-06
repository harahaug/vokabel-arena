# ⚡ Vokabel-Arena – Englisch Klasse 7
Von **Harald Haug**. Läuft komplett im Browser, ohne KI/Server.

- 📸 Heft abfotografieren → Texterkennung (Tesseract.js, im Browser) → korrigieren → Karten
- 🃏 3D-Sammelkarten mit Neigung, Hologlanz, Flip- und Deal-Animation; Seltenheit steigt mit dem Lernstand
- 🎚️ Leicht (auswählen) · Mittel (tippen + Tipps) · Schwer (Zeit + Hör-Rätsel)
- 🔀 Abfrage-Richtung pro Karte zufällig (EN→DE / DE→EN) oder fest
- 🔊 Aussprache über die Sprachausgabe des Geräts (Stimme/Tempo wählbar, 🐢 langsam)
- 💾 Daten liegen auf dem Gerät (localStorage); Backup als JSON; installierbar & offline (PWA)

## Veröffentlichen
- **Cloudflare Pages:** Build-Befehl `sh build.sh`, Ausgabeordner `dist`.
- Lokal testen: `python3 -m http.server ` → http://localhost:8000
Kamera/Sprache/Offline brauchen HTTPS (Pages/Netlify liefern das).
