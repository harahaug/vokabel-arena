/* Vokabel-Arena – von Harald Haug
   Läuft komplett im Browser (kein Server, keine KI-API nötig):
   · Speicher: localStorage auf dem eigenen Gerät
   · Aussprache: Sprachausgabe des Geräts (Web Speech API)
   · Foto-Erkennung: Tesseract.js (OCR im Browser) */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Starter-Wortschatz (Klasse 7, allgemein) ---------- */
const STARTER = `achieve|erreichen
adventure|Abenteuer
afraid|ängstlich
agree|zustimmen
borrow|ausleihen
brave|mutig
bridge|Brücke
careful|vorsichtig
celebrate|feiern
cheap|billig
climb|klettern
cloud|Wolke
dangerous|gefährlich
decide|entscheiden
dream|Traum
earth|Erde
enough|genug
exciting|aufregend
famous|berühmt
forest|Wald
forget|vergessen
guess|raten
holiday|Urlaub
invite|einladen
journey|Reise
knowledge|Wissen
lazy|faul
lonely|einsam
mountain|Berg
neighbour|Nachbar
patient|geduldig
pocket money|Taschengeld
promise|versprechen
quiet|leise
repeat|wiederholen
secret|Geheimnis
strange|seltsam
suddenly|plötzlich
village|Dorf
weather|Wetter`.split('\n').map(l => l.split('|'));

const IRREG = `be|was/were|been|sein
become|became|become|werden
begin|began|begun|anfangen; beginnen
bleed|bled|bled|bluten
break|broke|broken|(zer)brechen; kaputt machen
bring|brought|brought|mitbringen
build|built|built|bauen
buy|bought|bought|kaufen
catch|caught|caught|fangen
choose|chose|chosen|wählen; sich entscheiden
come|came|come|kommen
cost|cost|cost|kosten
cut|cut|cut|schneiden
deal with|dealt with|dealt with|sich befassen mit, umgehen mit
do|did|done|machen; tun
draw|drew|drawn|zeichnen
drink|drank|drunk|trinken
drive|drove|driven|fahren
eat|ate|eaten|essen
fall|fell|fallen|fallen
feed|fed|fed|füttern
feel|felt|felt|(sich) fühlen
fight|fought|fought|bekämpfen; ankämpfen gegen
find|found|found|finden
fly|flew|flown|fliegen
forget|forgot|forgotten|vergessen
get|got|got|bekommen; holen; kaufen; gelangen; werden; bringen
give|gave|given|geben; angeben, mitteilen
go|went|gone|gehen; fahren
grow|grew|grown|wachsen; anbauen
hang (up)|hung (up)|hung (up)|hängen; aufhängen
have|had|had|haben; essen; trinken
hear|heard|heard|hören
hide|hid|hidden|(sich) verstecken
hit|hit|hit|schlagen; stoßen gegen; treffen
hold|held|held|(fest)halten
hurt|hurt|hurt|wehtun, schmerzen; verletzen`.split('\n').map(l => l.split('|'));

/* ---------- Speicher ---------- */
const PK = 'vokabelarena.profiles', CK = 'vokabelarena.current', OLD = 'vokabelarena.v1';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } }, del: k => { try { localStorage.removeItem(k); } catch (e) { } } };
const defaults = () => ({ cards: [], set: { dir: 'mix', level: 'mittel', num: '10', sound: true, autospeak: true, voice: '', rate: 0.85 }, xp: 0, streak: 0, lastDay: '' });
let profiles = []; try { profiles = JSON.parse(ls.get(PK)) || []; } catch (e) { }
if (!profiles.length && ls.get(OLD)) { profiles = [{ id: 'p1', name: 'Ich' }]; ls.set('vokabelarena.v1.p1', ls.get(OLD)); ls.set(PK, JSON.stringify(profiles)); }   // alte Daten übernehmen
let curId = '', db = defaults();
const key = () => OLD + '.' + curId;
function loadDB() { db = defaults(); try { const raw = JSON.parse(ls.get(key())); if (raw) db = { ...defaults(), ...raw, set: { ...defaults().set, ...raw.set } }; } catch (e) { } }
const save = () => { if (curId) ls.set(key(), JSON.stringify(db)); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm0 = s => s.trim().replace(/\s+/g, ' ');
function addCards(pairs, unit = '') {
  let n = 0;
  const seen = new Set(db.cards.map(c => c.en.toLowerCase() + '|' + c.de.toLowerCase()));
  for (const [en, de] of pairs) {
    const e = norm0(en), d = norm0(de); if (!e || !d) continue;
    const k = e.toLowerCase() + '|' + d.toLowerCase(); if (seen.has(k)) continue;
    seen.add(k); db.cards.push({ id: uid(), added: Date.now(), en: e, de: d, unit: norm0(unit), box: 0, ok: 0, bad: 0 }); n++;
  }
  save(); refresh(); fillUnits(); return n;
}
function addVerbs(rows, unit = 'Irregular verbs') {
  let n = 0; const seen = new Set(db.cards.map(c => c.en.toLowerCase() + '|' + c.de.toLowerCase()));
  for (const [inf, past, pp, de] of rows) {
    const i = norm0(inf || '').replace(/^\(?to\)?\s+/i, ''), p = norm0(past || ''), q = norm0(pp || ''), d = norm0(de || '');
    if (!i || !p || !q || !d) continue;
    const en = 'to ' + i, k = en.toLowerCase() + '|' + d.toLowerCase(); if (seen.has(k)) continue;
    seen.add(k); db.cards.push({ id: uid(), added: Date.now(), en, de: d, forms: [p, q], unit: norm0(unit), box: 0, ok: 0, bad: 0 }); n++;
  }
  save(); refresh(); fillUnits(); return n;
}
const addedOf = c => c.added || parseInt(c.id.slice(0, -4), 36) || 0;
const dayStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function whenRange(w) {
  const now = new Date(), t0 = dayStart(now);
  if (w === 'today') return [t0, Infinity];
  if (w === 'week') return [t0 - ((now.getDay() + 6) % 7) * 864e5, Infinity];   // ab Montag
  if (w === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Infinity];
  if (w === 'range') { const f = db.set.from ? dayStart(new Date(db.set.from + 'T00:00')) : 0, t = db.set.to ? dayStart(new Date(db.set.to + 'T00:00')) + 864e5 : Infinity; return [f, t]; }
  return [0, Infinity];
}
const pool = (w = db.set.when || 'all', unit = db.set.unit) => { const [a, b] = whenRange(w); return db.cards.filter(c => (!unit || c.unit === unit) && addedOf(c) >= a && addedOf(c) < b); };
const units = () => [...new Set(db.cards.map(c => c.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
function fillUnits() { $('#units').innerHTML = units().map(u => `<option value="${esc(u)}">`).join(''); }

/* ---------- Navigation ---------- */
const views = $$('.view');
function show(name) {
  views.forEach(v => v.hidden = v.id !== 'v-' + name);
  window.scrollTo(0, 0);
  if (name === 'library') renderLib();
  if (name === 'setup') renderSetup();
  if (name === 'settings') renderSettings();
  if (name !== 'game') stopTimer();
  if (name === 'profiles') renderProfiles();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { if (!curId) { toast('Erst einen Spieler wählen 👤'); return; } sfx('tap'); show(b.dataset.go); } });
function refresh() {
  const me = profiles.find(p => p.id === curId); $('#who').textContent = '👤 ' + (me ? me.name : '–');
  $('#xp').textContent = db.xp; $('#streak').textContent = db.streak;
  $('#home-count').textContent = db.cards.length ? `${db.cards.length} Karten bereit` : 'Erst Karten sammeln!';
}
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

/* ---------- Sounds (WebAudio, kein Download) ---------- */
let actx;
function sfx(kind) {
  if (!db.set.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { ok: [[523, 0], [659, .09], [784, .18]], bad: [[220, 0], [165, .14]], tap: [[600, 0]], win: [[523, 0], [659, .1], [784, .2], [1047, .3]], flip: [[300, 0], [500, .05]] }[kind] || [];
    seq.forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + t;
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.12, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .22);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .25);
    });
  } catch (e) { }
}

/* ---------- Aussprache ---------- */
let voices = [];
function loadVoices() { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; if (!$('#v-settings').hidden) renderSettings(); }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const goodName = /natural|premium|enhanced|neural|google|samantha|daniel|serena|karen|moira|siri/i;
function pickVoice(lang) {
  const pre = lang.slice(0, 2);
  const list = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(pre));
  if (pre === 'en' && db.set.voice) { const v = list.find(v => v.name === db.set.voice); if (v) return v; }
  const score = v => (goodName.test(v.name) ? 4 : 0) + (v.lang.replace('_', '-').toLowerCase() === (pre === 'en' ? 'en-gb' : 'de-de') ? 2 : 0) + (v.lang.toLowerCase().startsWith('en-us') ? 1 : 0) + (v.localService ? 2 : 0);
  return list.sort((a, b) => score(b) - score(a))[0];
}
function speak(text, lang = 'en', slow = false) {
  if (!window.speechSynthesis) { toast('Dein Browser kann nicht sprechen 😢'); return; }
  const clean = text.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim(); if (!clean) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang === 'en' ? 'en-GB' : 'de-DE';
  const v = pickVoice(lang); if (v) { u.voice = v; u.lang = v.lang; }
  u.rate = Math.max(.4, db.set.rate * (slow ? .6 : 1)); u.pitch = 1.02;
  speechSynthesis.speak(u);
}


/* ---------- Anime-Figuren (pro Wort automatisch, als SVG) ---------- */
function hash(str) { let h = 2166136261; for (const c of str.toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const themeOf = () => (profiles.find(p => p.id === curId) || {}).theme || 'anime';
function vampireSVG(seed) {
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length], dk = '#14102e';
  const hair = pick(['#1a1a2e', '#3b0a2a', '#e8e8ff', '#5a1a8a'], 0), eye = pick(['#ff1744', '#ff5252', '#ff9100', '#d500f9'], 3), cape = pick(['#7a0019', '#3a0a5a', '#0b0b2a'], 6);
  const bats = (h >>> 9) & 1 ? `<path d="M96 24q8-8 14 0q6-6 10 2q-8 0-10 8q-3-6-14-10z" fill="${dk}"/>` : '';
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">${bats}
  <path d="M14 120L26 86Q60 112 94 86L106 120Z" fill="${cape}" stroke="${dk}" stroke-width="2.5"/><path d="M26 86L40 120M94 86L80 120" stroke="#000" stroke-opacity=".3" stroke-width="2"/>
  <ellipse cx="60" cy="66" rx="31" ry="36" fill="#f3e9f2" stroke="${dk}" stroke-width="2.5"/>
  <path d="M26 64Q20 20 60 16Q100 20 94 64Q90 40 76 34L60 46L44 34Q30 40 26 64Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M24 30L12 8L40 22ZM96 30L108 8L80 22Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" opacity="0"/>
  <path d="M33 62Q45 54 57 62L55 74Q45 80 35 74Z" fill="#fff" stroke="${dk}" stroke-width="2.5"/><path d="M63 62Q75 54 87 62L85 74Q75 80 65 74Z" fill="#fff" stroke="${dk}" stroke-width="2.5"/>
  <ellipse cx="45" cy="68" rx="6" ry="8" fill="${eye}"/><ellipse cx="75" cy="68" rx="6" ry="8" fill="${eye}"/><ellipse cx="45" cy="69" rx="2" ry="5" fill="${dk}"/><ellipse cx="75" cy="69" rx="2" ry="5" fill="${dk}"/><circle cx="43" cy="65" r="2" fill="#fff"/><circle cx="73" cy="65" r="2" fill="#fff"/>
  <path d="M33 58L57 60M87 58L63 60" stroke="${dk}" stroke-width="4" stroke-linecap="round"/>
  <path d="M50 87Q60 92 70 87" fill="#fff" stroke="${dk}" stroke-width="2.5"/><path d="M53 88l2 7 3-6M67 88l-2 7-3-6" fill="#fff" stroke="${dk}" stroke-width="1.5" stroke-linejoin="round"/>
  <ellipse cx="36" cy="82" rx="5" ry="3" fill="#ff5a7a" opacity=".45"/><ellipse cx="84" cy="82" rx="5" ry="3" fill="#ff5a7a" opacity=".45"/></svg>`;
}
function blockySVG(seed) {
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length], dk = '#14102e';
  const skin = pick(['#ffd9b3', '#e8b98a', '#c68c5a', '#f7d6c4'], 0), hair = pick(['#3a2a1a', '#ffcc33', '#ff3d8b', '#2d9cff', '#35e08a', '#8a5cff'], 3), shirt = pick(['#ff7043', '#29b6f6', '#66bb6a', '#ab47bc', '#ffee58'], 6), style = (h >>> 9) % 3;
  const top = style === 0 ? `<rect x="22" y="14" width="76" height="22" fill="${hair}" stroke="${dk}" stroke-width="3"/>` : style === 1 ? `<rect x="22" y="14" width="76" height="22" fill="${hair}" stroke="${dk}" stroke-width="3"/><rect x="14" y="30" width="14" height="40" fill="${hair}" stroke="${dk}" stroke-width="3"/><rect x="92" y="30" width="14" height="40" fill="${hair}" stroke="${dk}" stroke-width="3"/>` : `<rect x="30" y="4" width="60" height="30" fill="${hair}" stroke="${dk}" stroke-width="3"/><rect x="22" y="30" width="76" height="8" fill="${hair}" stroke="${dk}" stroke-width="3"/>`;
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">
  <rect x="26" y="92" width="68" height="28" fill="${shirt}" stroke="${dk}" stroke-width="3"/>
  <rect x="24" y="28" width="72" height="66" fill="${skin}" stroke="${dk}" stroke-width="3"/>${top}
  <rect x="38" y="56" width="14" height="16" fill="#fff" stroke="${dk}" stroke-width="3"/><rect x="68" y="56" width="14" height="16" fill="#fff" stroke="${dk}" stroke-width="3"/><rect x="44" y="60" width="8" height="12" fill="${dk}"/><rect x="74" y="60" width="8" height="12" fill="${dk}"/>
  <rect x="48" y="80" width="24" height="6" fill="${dk}"/><rect x="30" y="76" width="8" height="6" fill="#ff8fab" opacity=".6"/><rect x="82" y="76" width="8" height="6" fill="#ff8fab" opacity=".6"/></svg>`;
}
function vinylSVG(seed) {
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length], dk = '#14102e';
  const skin = pick(['#ffe0c8', '#f2c9a5', '#c98f62', '#8d5a3a'], 0), cl = pick(['#ff4f7b', '#2d9cff', '#35e08a', '#ffb400', '#8a5cff', '#ff7a2d'], 3), cl2 = pick(['#14102e', '#ffffff', '#ffd23f'], 6);
  const hat = (h >>> 9) % 4, glass = (h >>> 12) & 1;
  const top = [`<path d="M16 46Q18 8 60 8Q102 8 104 46Q60 30 16 46Z" fill="${cl}" stroke="${dk}" stroke-width="3"/><circle cx="60" cy="8" r="7" fill="${cl2}" stroke="${dk}" stroke-width="3"/>`,
    `<path d="M16 50Q20 10 60 10Q100 10 104 50Q92 28 60 30Q28 28 16 50Z" fill="${pick(['#14102e', '#ffcc33', '#ff5fa2', '#6a7bff'], 15)}" stroke="${dk}" stroke-width="3"/><path d="M52 10l8-8 8 8" fill="none" stroke="${dk}" stroke-width="3"/>`,
    `<path d="M16 48Q20 10 60 10Q100 10 104 48L116 52L100 56Q60 36 20 56L4 52Z" fill="${cl}" stroke="${dk}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M20 44Q24 12 60 12Q96 12 100 44Q80 24 60 28Q40 24 20 44Z" fill="${pick(['#14102e', '#8a5a2b', '#e8d27a', '#c0392b'], 15)}" stroke="${dk}" stroke-width="3"/><path d="M30 24L22 8L44 18ZM90 24L98 8L76 18Z" fill="${pick(['#14102e', '#8a5a2b', '#e8d27a', '#c0392b'], 15)}" stroke="${dk}" stroke-width="3" stroke-linejoin="round"/>`][hat];
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">
  <rect x="38" y="92" width="44" height="26" rx="8" fill="${cl}" stroke="${dk}" stroke-width="3"/><rect x="38" y="104" width="44" height="6" fill="${cl2}" opacity=".7"/>
  <rect x="12" y="14" width="96" height="82" rx="40" fill="${skin}" stroke="${dk}" stroke-width="3"/>
  <ellipse cx="34" cy="38" rx="14" ry="8" fill="#fff" opacity=".35" transform="rotate(-25 34 38)"/>${top}
  <circle cx="42" cy="62" r="8.5" fill="${dk}"/><circle cx="78" cy="62" r="8.5" fill="${dk}"/><circle cx="39" cy="59" r="3" fill="#fff"/><circle cx="75" cy="59" r="3" fill="#fff"/>
  ${glass ? `<circle cx="42" cy="62" r="13" fill="#9fd0ff" fill-opacity=".25" stroke="${dk}" stroke-width="3"/><circle cx="78" cy="62" r="13" fill="#9fd0ff" fill-opacity=".25" stroke="${dk}" stroke-width="3"/><path d="M55 62h10" stroke="${dk}" stroke-width="3"/>` : ''}
  <ellipse cx="28" cy="78" rx="6" ry="4" fill="#ff8fab" opacity=".55"/><ellipse cx="92" cy="78" rx="6" ry="4" fill="#ff8fab" opacity=".55"/><path d="M54 80Q60 85 66 80" fill="none" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}
function robotSVG(seed) {
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length], dk = '#14102e';
  const metal = pick(['#c9d3e6', '#ffb36b', '#9be3ff', '#d9b8ff', '#9af0c0'], 0), led = pick(['#00e5ff', '#ff2e63', '#ffd23f', '#35e08a', '#d500f9'], 3), ant = (h >>> 9) % 3, smile = (h >>> 12) & 1;
  const antenna = ant === 0 ? `<path d="M60 26V10" stroke="${dk}" stroke-width="4"/><circle cx="60" cy="9" r="6" fill="${led}" stroke="${dk}" stroke-width="3"/>` : ant === 1 ? `<path d="M44 28L36 10M76 28L84 10" stroke="${dk}" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="9" r="5" fill="${led}" stroke="${dk}" stroke-width="2.5"/><circle cx="84" cy="9" r="5" fill="${led}" stroke="${dk}" stroke-width="2.5"/>` : `<path d="M50 26Q60 4 72 26" fill="${led}" stroke="${dk}" stroke-width="3"/>`;
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">${antenna}
  <rect x="34" y="98" width="52" height="22" rx="8" fill="${metal}" stroke="${dk}" stroke-width="3"/><circle cx="60" cy="109" r="5" fill="${led}" stroke="${dk}" stroke-width="2"/>
  <rect x="6" y="52" width="14" height="28" rx="6" fill="${led}" stroke="${dk}" stroke-width="3"/><rect x="100" y="52" width="14" height="28" rx="6" fill="${led}" stroke="${dk}" stroke-width="3"/>
  <rect x="16" y="24" width="88" height="74" rx="22" fill="${metal}" stroke="${dk}" stroke-width="3"/>
  <path d="M26 34Q40 28 60 28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <rect x="26" y="42" width="68" height="34" rx="14" fill="#1b1a3a" stroke="${dk}" stroke-width="3"/>
  <ellipse cx="45" cy="59" rx="8" ry="10" fill="${led}"/><ellipse cx="75" cy="59" rx="8" ry="10" fill="${led}"/><circle cx="42" cy="55" r="3" fill="#fff"/><circle cx="72" cy="55" r="3" fill="#fff"/>
  ${smile ? `<path d="M46 86Q60 96 74 86" fill="none" stroke="${dk}" stroke-width="4" stroke-linecap="round"/>` : `<rect x="46" y="84" width="28" height="7" rx="3.5" fill="${dk}"/><path d="M53 84v7M60 84v7M67 84v7" stroke="${metal}" stroke-width="2"/>`}</svg>`;
}
function funkSVG(seed) {
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length], dk = '#14102e';
  const skin = pick(['#ffe0c8', '#f2c9a5', '#c98f62', '#8d5a3a', '#6b3f26'], 0), hair = pick(['#1a1a2e', '#3b2314', '#ff3d8b', '#8a5cff', '#ffb400', '#12d6a0'], 3), lens = pick(['#ff8a3d', '#ff2e90', '#00e5ff', '#ffd23f', '#a855f7'], 6), jacket = pick(['#ff2e90', '#6a2cff', '#ff8a3d', '#12b886'], 9), style = (h >>> 12) % 3, note = pick(['♪', '♫', '♬'], 15);
  const hairBack = style === 0 ? `<circle cx="60" cy="44" r="46" fill="${hair}" stroke="${dk}" stroke-width="3"/>` : style === 1 ? `<path d="M18 60Q6 12 60 8Q114 12 102 60Q96 30 60 28Q24 30 18 60Z" fill="${hair}" stroke="${dk}" stroke-width="3"/><path d="M26 22q-10-4-12-14M94 22q10-4 12-14M60 8V-2" stroke="${hair}" stroke-width="5" stroke-linecap="round" opacity="0"/>` : `<path d="M20 52Q22 14 60 12Q98 14 100 52Q80 34 60 38Q40 34 20 52Z" fill="${lens}" stroke="${dk}" stroke-width="3"/><path d="M96 38l16 10-6 8" fill="${lens}" stroke="${dk}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">
  <text x="96" y="28" font-size="22" fill="#ffd23f" stroke="${dk}" stroke-width=".8" font-family="Arial">${note}</text>
  <path d="M30 104Q60 124 90 104L98 120H22Z" fill="${jacket}" stroke="${dk}" stroke-width="3"/><path d="M50 106L60 120L70 106" fill="#fff" stroke="${dk}" stroke-width="2"/>
  <path d="M46 108Q60 120 74 108" fill="none" stroke="#ffd23f" stroke-width="3.5"/><circle cx="60" cy="117" r="4" fill="#ffd23f" stroke="${dk}" stroke-width="1.5"/>
  ${style === 0 ? hairBack : ''}
  <ellipse cx="60" cy="68" rx="31" ry="34" fill="${skin}" stroke="${dk}" stroke-width="3"/>
  ${style === 1 ? hairBack : style === 2 ? hairBack : `<path d="M30 56Q40 32 60 34Q80 32 90 56Q76 44 60 46Q44 44 30 56Z" fill="${hair}" stroke="${dk}" stroke-width="3"/>`}
  <path d="M26 62Q60 22 94 62" fill="none" stroke="${dk}" stroke-width="7" stroke-linecap="round"/><rect x="14" y="56" width="15" height="28" rx="7" fill="${lens}" stroke="${dk}" stroke-width="3"/><rect x="91" y="56" width="15" height="28" rx="7" fill="${lens}" stroke="${dk}" stroke-width="3"/>
  <circle cx="45" cy="68" r="12" fill="${lens}" stroke="${dk}" stroke-width="3.5"/><circle cx="75" cy="68" r="12" fill="${lens}" stroke="${dk}" stroke-width="3.5"/><path d="M57 66h6" stroke="${dk}" stroke-width="3.5"/>
  <path d="M38 62l8-4M68 62l8-4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  <path d="M48 88Q60 98 72 88Q60 92 48 88Z" fill="#fff" stroke="${dk}" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
function animeSVG(seed, theme = themeOf()) {
  if (theme === 'funk') return funkSVG(seed);
  if (theme === 'vinyl') return vinylSVG(seed); if (theme === 'robot') return robotSVG(seed);
  if (theme === 'vampir') return vampireSVG(seed); if (theme === 'blocky') return blockySVG(seed);
  const h = hash(seed), pick = (a, n) => a[(h >>> n) % a.length];
  const hair = pick(['#1a1a2e', '#ff3d8b', '#2d9cff', '#8a5cff', '#e8f0ff', '#12d6a0', '#ff7a2d', '#c0392b'], 0);
  const hi = pick(['#6a7bff', '#ff9ac8', '#9fd0ff', '#d2b8ff', '#ffffff', '#a0ffe0', '#ffd09a', '#ff9a8a'], 0);
  const eye = pick(['#ff2e63', '#00e5ff', '#ffd23f', '#9d4dff', '#35e08a'], 3);
  const skin = pick(['#ffe3cf', '#f6cfb5', '#fbe0d0'], 6), style = (h >>> 9) % 3, acc = (h >>> 12) % 5, dk = '#14102e';
  const jacket = pick(['#241a5c', '#7a1f4f', '#0f4c75', '#3a2a7a'], 17);
  const back = style === 0 ? `<path d="M22 56Q10 100 30 116L50 80ZM98 56Q110 100 90 116L70 80Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/>`
    : style === 1 ? `<path d="M26 60Q4 70 10 112Q26 104 34 76ZM94 60Q116 70 110 112Q94 104 86 76Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/>`
    : `<path d="M88 30Q122 34 112 70Q108 92 118 108Q92 100 94 70Q92 52 80 44Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 56Q14 84 28 100L40 70Z" fill="${hair}" stroke="${dk}" stroke-width="2.5"/>`;
  const fringe = `<path d="M24 66Q16 22 60 16Q104 22 96 66Q94 44 84 38Q72 52 60 36Q52 50 38 40Q28 46 24 66Z" fill="${hair}" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 30Q58 20 78 28" fill="none" stroke="${hi}" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`;
  const E = (x, f) => `<path d="M${x - 11} ${63 + f * 2}Q${x} ${56 - f * 2} ${x + 11} ${62 - f * 2}L${x + 10} 76Q${x} 81 ${x - 10} 76Z" fill="#fff" stroke="${dk}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="${x}" cy="70" rx="7" ry="8.5" fill="${eye}"/><ellipse cx="${x}" cy="71" rx="2.6" ry="5.2" fill="${dk}"/><circle cx="${x - 2.5}" cy="67" r="2.4" fill="#fff"/><circle cx="${x + 3}" cy="74" r="1.2" fill="#fff"/>
    <path d="M${x - 13} ${63 + f * 2}Q${x} ${54 - f * 2} ${x + 13} ${61 - f * 2}" fill="none" stroke="${dk}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M${x + f * 12} ${61 - f * 2}l${f * 6} -4M${x + f * 9} ${60 - f * 2}l${f * 6} -1" stroke="${dk}" stroke-width="2.2" stroke-linecap="round"/>`;
  const extra = [
    `<path d="M24 54Q60 22 96 54" fill="none" stroke="${dk}" stroke-width="7"/><rect x="14" y="46" width="13" height="28" rx="6" fill="#ff2e63" stroke="${dk}" stroke-width="2.5"/><rect x="93" y="46" width="13" height="28" rx="6" fill="#ff2e63" stroke="${dk}" stroke-width="2.5"/>`,
    `<path d="M30 30L26 8L48 22ZM90 30L94 8L72 22Z" fill="${dk}" stroke="${hi}" stroke-width="2"/><path d="M31 26L30 15L41 22ZM89 26L90 15L79 22Z" fill="#ff2e63"/>`,
    `<path d="M22 44H98" stroke="#00e5ff" stroke-width="6" stroke-linecap="round" opacity=".9"/><circle cx="82" cy="44" r="4.5" fill="#fff" stroke="${dk}" stroke-width="1.5"/>`,
    `<path d="M70 26l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L60 33.500l7-.5z" fill="#ffd23f" stroke="${dk}" stroke-width="1.8" stroke-linejoin="round"/>`,
    `<path d="M70 28l12 3M70 33l13 5" stroke="#ff2e63" stroke-width="3.5" stroke-linecap="round"/>`][acc];
  const mouth = (h >>> 15) & 1 ? `<path d="M53 90Q60 95 69 87" fill="none" stroke="${dk}" stroke-width="3" stroke-linecap="round"/>` : `<path d="M54 90Q61 91 68 89" fill="none" stroke="${dk}" stroke-width="3" stroke-linecap="round"/><path d="M68 89l3-3" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<svg class="anime" viewBox="0 0 120 120" aria-hidden="true">${back}
  <path d="M30 104Q60 124 90 104L96 120H24Z" fill="${jacket}" stroke="${dk}" stroke-width="2.5"/><path d="M48 104L60 118L72 104" fill="#fff" stroke="${dk}" stroke-width="2"/>
  <path d="M42 100Q60 108 78 100" fill="none" stroke="${dk}" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="60" cy="68" rx="32" ry="36" fill="${skin}" stroke="${dk}" stroke-width="2.5"/>
  ${fringe}${extra}${E(45, 1)}${E(75, -1)}
  <ellipse cx="36" cy="82" rx="5" ry="3" fill="#ff8fab" opacity=".55"/><ellipse cx="84" cy="82" rx="5" ry="3" fill="#ff8fab" opacity=".55"/>${mouth}</svg>`;
}
/* ---------- Spieler / Profile (pro Gerät) ---------- */
function login(id) { curId = id; ls.set(CK, id); loadDB(); fillUnits(); refresh(); show('home'); }
function renderProfiles() {
  $('#prof-grid').innerHTML = profiles.map((p, i) => `<div class="mc r${(hash(p.name) % 4) + 1}" data-id="${p.id}" style="animation-delay:${i * 60}ms">
    <div class="t"><span>SPIELER</span><button class="pdel" data-del="${p.id}" aria-label="Löschen">✖</button></div>
    <div class="in">${animeSVG(p.seed || p.name, p.theme || 'anime')}<b>${esc(p.name)}</b></div><div class="pw"><i style="width:100%"></i></div></div>`).join('');
}
$('#prof-grid').onclick = e => {
  const d = e.target.closest('[data-del]');
  if (d) { e.stopPropagation(); const p = profiles.find(x => x.id === d.dataset.del); if (p && confirm(`Spieler „${p.name}“ mit allen Karten löschen?`)) { profiles = profiles.filter(x => x !== p); ls.set(PK, JSON.stringify(profiles)); ls.del(OLD + '.' + p.id); if (curId === p.id) { curId = ''; db = defaults(); } renderProfiles(); refresh(); } return; }
  const m = e.target.closest('.mc'); if (m) { sfx('win'); login(m.dataset.id); }
};
function addProfile() {
  const name = norm0($('#prof-name').value); if (!name) { toast('Bitte einen Namen eingeben'); return; }
  if (profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('Den Namen gibt es schon'); return; }
  const p = { id: 'p' + uid(), name, theme: pickTheme, seed: pickSeed }; profiles.push(p); ls.set(PK, JSON.stringify(profiles)); $('#prof-name').value = ''; confetti(60); login(p.id);
}
let pickTheme = 'anime', pickSeed = uid();
const THEMES = [['anime', '🎀', 'Anime'], ['vampir', '🧛', 'Vampir'], ['blocky', '🧱', 'Block-Welt'], ['vinyl', '🪆', 'Pop-Figur'], ['robot', '🤖', 'Roboter'], ['funk', '🎧', 'Funk']];
function renderPicker() {
  $('#theme-seg').innerHTML = THEMES.map(([k, i, n]) => `<button data-v="${k}" class="${k === pickTheme ? 'on' : ''}"><b>${i}</b><small style="display:block">${n}</small></button>`).join('');
  $('#prof-prev').innerHTML = animeSVG(pickSeed, pickTheme);
}
$('#theme-seg').onclick = e => { const b = e.target.closest('button'); if (b) { pickTheme = b.dataset.v; sfx('tap'); renderPicker(); } };
$('#prof-dice').onclick = () => { pickSeed = uid(); sfx('flip'); renderPicker(); };
renderPicker();
$('#prof-add').onclick = addProfile; $('#prof-name').onkeydown = e => { if (e.key === 'Enter') addProfile(); };
$('#who').onclick = () => { sfx('tap'); show('profiles'); };

/* ---------- Meine Karten ---------- */
const rarity = c => c.box >= 4 ? 4 : c.box >= 3 ? 3 : c.box >= 2 ? 2 : c.box >= 1 ? 1 : 0;
const RN = ['NEU', 'SELTEN', 'STARK', 'EPISCH', 'LEGENDÄR'];
function renderLib() {
  const q = $('#lib-search').value.trim().toLowerCase();
  const list = db.cards.filter(c => !q || c.en.toLowerCase().includes(q) || c.de.toLowerCase().includes(q) || (c.unit || '').toLowerCase().includes(q));
  $('#lib-count').textContent = `(${db.cards.length})`;
  $('#lib-empty').hidden = db.cards.length > 0;
  $('#lib-grid').innerHTML = list.map((c, i) => `
    <div class="mc r${rarity(c)}" data-id="${c.id}" style="animation-delay:${Math.min(i, 20) * 30}ms">
      <div class="t"><span>${esc(c.unit || RN[rarity(c)])}</span><span>${'★'.repeat(c.box)}</span></div>
      <div class="in">${animeSVG(c.en)}<b>${esc(c.en)}</b>${c.forms ? `<span>${esc(c.forms.join(' · '))}</span>` : ''}<span>${esc(c.de)}</span></div>
      <div class="pw"><i style="width:${c.box * 25}%"></i></div></div>`).join('');
}
$('#lib-search').oninput = renderLib;
$('#lib-grid').onclick = e => { const m = e.target.closest('.mc'); if (m) editCard(m.dataset.id); };
$('#load-verbs2').onclick = $('#load-verbs').onclick = () => { const n = addVerbs(IRREG); sfx('win'); confetti(); toast(`🎁 ${n} Verben-Karten gelegt!`); renderLib(); };
$('#load-starter').onclick = () => { const n = addCards(STARTER); sfx('win'); confetti(); toast(`🎁 ${n} Karten gelegt!`); renderLib(); };

const dlg = $('#dlg'); let editing = null;
function editCard(id) {
  editing = id ? db.cards.find(c => c.id === id) : null;
  $('#dlg-title').textContent = editing ? 'Karte bearbeiten' : 'Neue Karte';
  $('#dlg-en').value = editing ? editing.en : ''; $('#dlg-de').value = editing ? editing.de : ''; $('#dlg-unit').value = editing ? editing.unit || '' : ''; $('#dlg-forms').value = editing && editing.forms ? editing.forms.join(', ') : '';
  $('#dlg-del').hidden = !editing; dlg.showModal();
}
$('#manual').onclick = () => editCard(null);
$('#dlg-speak').onclick = () => speak($('#dlg-en').value, 'en');
$('#dlg-del').onclick = () => { if (editing && confirm('Karte wirklich löschen?')) { db.cards = db.cards.filter(c => c !== editing); save(); refresh(); renderLib(); dlg.close(); } };
$('#dlg-form').addEventListener('submit', e => {
  if (e.submitter && e.submitter.value === 'ok') {
    const en = norm0($('#dlg-en').value), de = norm0($('#dlg-de').value);
    if (!en || !de) { e.preventDefault(); toast('Bitte beide Felder ausfüllen'); return; }
    const fm = $('#dlg-forms').value.split(',').map(norm0).filter(Boolean); const forms = fm.length === 2 ? fm : null;
    if (editing) { editing.forms = forms || undefined; editing.en = en; editing.de = de; editing.unit = norm0($('#dlg-unit').value); save(); fillUnits(); } else { addCards([[en, de]], $('#dlg-unit').value); if (forms) { const c = db.cards[db.cards.length - 1]; c.forms = forms; save(); } }
    renderLib(); refresh(); toast('✅ Gespeichert');
  }
});

/* ---------- Scan (Kamera + OCR im Browser) ---------- */
const OCR_URL = 'ocr/tesseract.min.js';   // lokal gehostet – keine Verbindung zu fremden Servern (DSGVO)
const abs = p => new URL(p, location.href).href;
function loadOCR() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = OCR_URL; s.onload = res; s.onerror = () => rej(new Error('offline')); document.head.appendChild(s); });
}
async function prepImage(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  const img = bmp || await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let lo = 255, hi = 0;
  for (let i = 0; i < p.length; i += 4) { const g = .3 * p[i] + .59 * p[i + 1] + .11 * p[i + 2]; p[i] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
  const k = 255 / Math.max(40, hi - lo);                 // Kontrast strecken
  for (let i = 0; i < p.length; i += 4) { const v = Math.max(0, Math.min(255, (p[i] - lo) * k)); p[i] = p[i + 1] = p[i + 2] = v; }
  x.putImageData(d, 0, 0);
  return c;
}
/** Text → [[links, rechts], …] */
function parseOCR(text) {
  const out = [];
  for (let line of text.split(/\n+/)) {
    line = line.replace(/[|_~^*#@{}\[\]<>«»]+/g, ' ').replace(/^\W*\d+[.)]\s*/, '').trim();
    if (line.length < 3) continue;
    const m = line.match(/\s*(?:[-–—=:→]|\s{2,}|\t)\s*/);
    if (m && m.index > 0) out.push([line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).trim()]);
    else out.push([line, '']);
  }
  return out;
}
function parseVerbs(text) {
  const rows = [];
  for (let line of text.split(/\n+/)) {
    line = line.replace(/(^|\s)\/[^\/\s][^\/]*\/(?=\s|$)/g, ' ').replace(/[|_~^*#@{}\[\]<>«»]+/g, ' ').replace(/^\s*\(?to\)?\s+/i, '').trim();
    if (line.length < 5) continue;
    let p = line.split(/\s{2,}|\t/).map(x => x.trim()).filter(Boolean);
    if (p.length < 4) { const w = line.split(/\s+/); p = w.length >= 4 ? [w[0], w[1], w[2], w.slice(3).join(' ')] : [line, '', '', '']; }
    rows.push([p[0], p[1], p[2], p.slice(3).join(' ')]);
  }
  return rows;
}
let scanRows = [], scanMode = 'words';
async function scanFile(file) {
  if (!file) return;
  const st = $('#ocr-status'), bar = $('#ocr-bar'), txt = $('#ocr-text');
  st.hidden = false; $('#review').hidden = true; bar.style.width = '4%'; txt.textContent = 'Foto wird vorbereitet …';
  try {
    const canvas = await prepImage(file);
    const pv = $('#preview'); pv.src = canvas.toDataURL('image/jpeg', .6); pv.hidden = false;
    txt.textContent = 'Lade Texterkennung (beim 1. Mal ca. 25 MB) …';
    await loadOCR();
    const { data } = await Tesseract.recognize(canvas, 'eng+deu', {
      workerPath: abs('ocr/worker.min.js'), corePath: abs('ocr/'), langPath: abs('ocr/lang'), gzip: true,
      logger: m => { if (m.progress != null) { bar.style.width = (10 + m.progress * 90) + '%'; txt.textContent = (m.status || 'lese') + ' … ' + Math.round(m.progress * 100) + '%'; } }
    });
    st.hidden = true;
    scanMode = $('#scan-mode').value;
    if (scanMode === 'verbs') scanRows = parseVerbs(data.text).map(t => ({ t, on: true }));
    else { let r = parseOCR(data.text); if ($('#scan-left').value === 'de') r = r.map(([a, b]) => [b, a]); scanRows = r.map(t => ({ t, on: !!(t[0] || t[1]) })); }
    if (!scanRows.length) { toast('Nichts erkannt – bitte nochmal oder von Hand tippen'); scanRows = [blankRow()]; }
    renderReview(); sfx('ok');
  } catch (err) {
    st.hidden = true;
    toast(err.message === 'offline' ? '📡 Für die Texterkennung brauchst du kurz Internet' : '😕 Das hat nicht geklappt');
    console.error(err);
  }
}
$('#cam').onchange = e => { scanFile(e.target.files[0]); e.target.value = ''; };
$('#gal').onchange = e => { scanFile(e.target.files[0]); e.target.value = ''; };
const blankRow = () => ({ t: scanMode === 'verbs' ? ['', '', '', ''] : ['', ''], on: true });
function renderReview() {
  const v = scanMode === 'verbs';
  $('#review').hidden = false; $('#rv-swap').hidden = v;
  $('#review-head').className = 'rows head' + (v ? ' v4' : ''); $('#review-head').innerHTML = '<span></span>' + (v ? '<span>Infinitiv</span><span>Past</span><span>Participle</span><span>Deutsch</span>' : '<span>🇬🇧 Englisch</span><span>🇩🇪 Deutsch</span>') + '<span></span>';
  $('#review-rows').innerHTML = scanRows.map((r, i) => `<div class="rows${v ? ' v4' : ''}" data-i="${i}">
    <input type="checkbox" ${r.on ? 'checked' : ''}>${r.t.map((x, c) => `<input type="text" value="${esc(x)}" autocapitalize="off" autocomplete="off">`).join('')}<button aria-label="Zeile löschen" data-del>✖</button></div>`).join('');
}
function syncRows() { $$('#review-rows .rows').forEach(el => { const i = +el.dataset.i; scanRows[i] = { t: $$('input[type=text]', el).map(x => x.value), on: $('input[type=checkbox]', el).checked }; }); }
$('#review-rows').onclick = e => { if (e.target.closest('[data-del]')) { syncRows(); scanRows.splice(+e.target.closest('.rows').dataset.i, 1); renderReview(); } };
$('#rv-add').onclick = () => { syncRows(); scanRows.push(blankRow()); renderReview(); };
$('#rv-swap').onclick = () => { syncRows(); scanRows = scanRows.map(r => ({ ...r, t: [r.t[1], r.t[0]] })); renderReview(); };
$('#rv-save').onclick = () => {
  syncRows(); const rows = scanRows.filter(r => r.on).map(r => r.t), unit = $('#scan-unit').value;
  const n = scanMode === 'verbs' ? addVerbs(rows, unit || 'Irregular verbs') : addCards(rows, unit);
  $('#review').hidden = true; $('#preview').hidden = true; sfx('win'); confetti();
  toast(n ? `🃏 ${n} neue Karten in deiner Sammlung!` : 'Diese Karten gab es schon');
  setTimeout(() => show('library'), 700);
};

/* ---------- Einstellungen ---------- */
function renderSettings() {
  const en = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  $('#voice').innerHTML = `<option value="">Automatisch (beste Stimme)</option>` + en.map(v => `<option ${v.name === db.set.voice ? 'selected' : ''} value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  $('#rate').value = db.set.rate; $('#rate-out').textContent = db.set.rate.toFixed(2) + '×';
  $('#sound').checked = db.set.sound; $('#autospeak').checked = db.set.autospeak;
  $('#voice-hint').textContent = !window.speechSynthesis ? 'Dieser Browser hat keine Sprachausgabe.' : en.length ? 'Tipp: Stimmen mit „Natural“, „Premium“ oder „Enhanced“ klingen am besten.' : 'Keine englische Stimme gefunden – installiere eine in den Geräte-Einstellungen (Sprachausgabe).';
}
$('#voice').onchange = e => { db.set.voice = e.target.value; save(); speak('Hello! Nice to meet you.'); };
$('#rate').oninput = e => { db.set.rate = +e.target.value; $('#rate-out').textContent = db.set.rate.toFixed(2) + '×'; save(); };
$('#voice-test').onclick = () => speak('The weather is beautiful today. Let us climb the mountain!');
$('#sound').onchange = e => { db.set.sound = e.target.checked; save(); };
$('#autospeak').onchange = e => { db.set.autospeak = e.target.checked; save(); };
$('#export').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }));
  a.download = 'vokabel-arena-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
};
$('#import').onchange = async e => {
  try { const j = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(j.cards)) throw 0; db = { ...defaults(), ...j, set: { ...defaults().set, ...j.set } }; save(); refresh(); toast('✅ Backup geladen (' + db.cards.length + ' Karten)'); }
  catch (_) { toast('Das ist kein gültiges Backup'); }
  e.target.value = '';
};
$('#wipe').onclick = () => { if (confirm('Wirklich ALLE Karten und Punkte löschen?')) { db = defaults(); save(); refresh(); toast('Alles gelöscht'); } };

/* ---------- Setup ---------- */
function renderSetup() {
  for (const [id, k] of [['seg-level', 'level'], ['seg-dir', 'dir'], ['seg-num', 'num']])
    $$('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === db.set[k]));
  const us = units(); if (db.set.unit && !us.includes(db.set.unit)) db.set.unit = '';
  $('#unit-sel').innerHTML = `<option value="">Alle Karten (${db.cards.length})</option>` + us.map(u => `<option ${u === db.set.unit ? 'selected' : ''} value="${esc(u)}">${esc(u)} (${db.cards.filter(c => c.unit === u).length})</option>`).join('');
  const wsel = $('#when-sel'); wsel.value = db.set.when || 'all'; $('#range-row').hidden = wsel.value !== 'range';
  [...wsel.options].forEach(o => { const n = o.value === 'range' ? null : pool(o.value).length; o.textContent = o.textContent.replace(/ \(\d+\)$/, '') + (n == null ? '' : ` (${n})`); });
  $('#d-from').value = db.set.from || ''; $('#d-to').value = db.set.to || '';
  $('#pool-info').textContent = `Damit spielst du ${pool().length} Karten.`;
  const w = $('#setup-warn');
  w.hidden = db.cards.length > 0; w.textContent = 'Du hast noch keine Karten – scanne dein Heft oder lade das Starter-Set unter „Meine Karten“.';
}
for (const [id, k] of [['seg-level', 'level'], ['seg-dir', 'dir'], ['seg-num', 'num']])
  $('#' + id).onclick = e => { const b = e.target.closest('button'); if (b) { db.set[k] = b.dataset.v; save(); sfx('tap'); renderSetup(); } };
$('#unit-sel').onchange = e => { db.set.unit = e.target.value; save(); renderSetup(); };
$('#when-sel').onchange = e => { db.set.when = e.target.value; save(); renderSetup(); };
$('#d-from').onchange = e => { db.set.from = e.target.value; save(); renderSetup(); };
$('#d-to').onchange = e => { db.set.to = e.target.value; save(); renderSetup(); };
$('#start').onclick = () => { if (!db.cards.length) { toast('Erst Karten sammeln 🃏'); return; } if (!pool().length) { toast('Für diese Auswahl gibt es keine Karten 📅'); return; } startGame(); };

/* ---------- Antworten prüfen ---------- */
const clean = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\(.*?\)/g, ' ').replace(/[.,!?;:"'’`´]/g, '').replace(/\s+/g, ' ').trim();
const strip = s => clean(s).replace(/^(to|the|a|an|der|die|das|ein|eine)\s+/, '');
const alts = s => [...new Set([s, ...s.split(/[\/;,]| oder /)].map(strip).filter(Boolean))];
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++)d[0][j] = j; for (let i = 1; i <= m; i++)for (let j = 1; j <= n; j++)d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function judge(input, answer, strict) {
  const a = alts(answer), u = strip(input); if (!u) return 'bad';
  if (a.includes(u)) return 'ok';
  if (!strict && a.some(x => x.length >= 5 && lev(x, u) <= 1)) return 'close';
  return 'bad';
}

/* ---------- Spiel ---------- */
const LV = { leicht: { pts: 10 }, mittel: { pts: 20 }, schwer: { pts: 30, time: 18 } };
let G = null;   // laufende Runde
function pickCards(pool) {
  const w = c => (5 - c.box) ** 2 + (c.bad > c.ok ? 6 : 0) + (c.ok + c.bad === 0 ? 8 : 0);
  const out = [], bag = [...pool], n = db.set.num === 'all' ? pool.length : Math.min(+db.set.num, pool.length);
  while (out.length < n && bag.length) { let t = bag.reduce((s, c) => s + w(c), 0) * Math.random(), i = 0; for (; i < bag.length - 1; i++) { t -= w(bag[i]); if (t <= 0) break; } out.push(...bag.splice(i, 1)); }
  return out;
}
function pickDir(c) {
  const d = db.set.dir, f = !!c.forms;
  if (d === 'en-de') return 'en-de';
  if (d === 'de-en') return f ? 'forms' : 'de-en';
  return Math.random() < .5 ? 'en-de' : f ? 'forms' : 'de-en';
}
function startGame(cards) {
  const level = db.set.level;
  G = { level, queue: (cards || pickCards(pool())).map(c => ({ c, dir: pickDir(c) })), i: 0, score: 0, combo: 0, best: 0, wrong: [], right: 0, busy: false };
  $('#score').textContent = 0; $('#combo').textContent = 0; $('#prog').style.width = '0';
  show('game'); nextQ();
}
const stage = $('#stage'), tilt = $('#tilt'), flip = $('#flip'), fl = $('#float');
async function nextQ() {
  if (G.i >= G.queue.length) return endGame();
  const q = G.q = G.queue[G.i]; q.hints = 0; q.listen = G.level === 'schwer' && q.dir === 'en-de' && Math.random() < .35 && !!window.speechSynthesis;
  G.busy = true; stopTimer(); $('#answer-area').innerHTML = ''; $('#timer').hidden = true;
  const r = rarity(q.c), from = q.dir === 'de-en' ? 'de' : 'en', to = q.dir === 'en-de' ? 'de' : 'en', forms = q.dir === 'forms';
  const text = { en: q.c.en, de: q.c.de };
  fl.className = 'float'; flip.classList.remove('on'); [$('#front'), $('#back')].forEach(f => f.className = 'face ' + (f.id === 'front' ? 'front' : 'back'));
  stage.className = 'stage r' + r;
  $('#front').innerHTML = faceHTML(q, r, from, text[from], true);
  $('#back').innerHTML = `<div class="sparkles"></div><div class="ct"><span class="tag">${to === 'en' ? '🇬🇧 ENGLISCH' : '🇩🇪 DEUTSCH'}</span><span class="lvl">${'★'.repeat(q.c.box) || '☆'}</span></div>
    <div class="art"><div class="flag">${animeSVG(q.c.en)}</div><div class="verdict" id="verdict"></div><div class="word" id="ans-word">${esc(forms ? q.c.en + ' · ' + q.c.forms.join(' · ') : text[to])}</div><div class="sub" id="ans-sub"></div>
    <div class="spks"><button class="spk" data-say="${forms ? 'forms' : to}">🔊</button>${to === 'en' ? `<button class="spk slow" data-say="${forms ? 'forms-slow' : 'en-slow'}">🐢</button>` : ''}</div></div>
    <div class="pwr">MERK-POWER<div class="pb"><i style="width:${q.c.box * 25}%"></i></div></div>`;
  void fl.offsetWidth; fl.classList.add('deal'); sfx('flip');
  $('#prog').style.width = (G.i / G.queue.length * 100) + '%';
  await wait(750); fl.classList.remove('deal');
  if (q.listen || ((q.dir === 'en-de' || q.dir === 'forms') && db.set.autospeak)) speak(q.c.en, 'en');
  buildAnswer(q, to, forms ? q.c.forms : text[to]); G.busy = false;
  if (LV[G.level].time) startTimer(LV[G.level].time);
}
function faceHTML(q, r, from, word, front) {
  return `<div class="sparkles"></div><div class="ct"><span class="tag">${from === 'en' ? '🇬🇧 ENGLISCH' : '🇩🇪 DEUTSCH'}</span><span class="lvl">${RN[r]}</span></div>
  <div class="art"><div class="flag">${q.listen ? '👂' : animeSVG(q.c.en)}</div>
  <div class="word ${word.length > 14 ? 'sm' : ''} ${q.listen ? 'listen' : ''}">${esc(word)}</div>
  ${q.listen ? '<div class="sub">Hör genau hin!</div>' : ''}${q.dir === 'forms' ? `<div class="sub">${esc(q.c.de)}<br><b>Past &amp; Participle?</b></div>` : ''}
  <div class="spks">${from === 'en' ? '<button class="spk" data-say="en">🔊 Anhören</button><button class="spk slow" data-say="en-slow">🐢</button>' : ''}</div></div>
  <div class="pwr">MERK-POWER<div class="pb"><i style="width:${q.c.box * 25}%"></i></div></div>`;
}
stage.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (!b || !G || !G.q) return; e.stopPropagation(); const k = b.dataset.say; if (k.startsWith('forms')) { speak(`${G.q.c.en}, ${G.q.c.forms.join(', ')}`, 'en', k === 'forms-slow'); return; } speak(k === 'en-slow' ? G.q.c.en : k === 'en' ? G.q.c.en : G.q.c.de, k.startsWith('en') ? 'en' : 'de', k === 'en-slow'); });

function buildAnswer(q, to, answer) {
  const area = $('#answer-area');
  if (q.dir === 'forms') {
    const mid = G.level !== 'schwer';
    area.innerHTML = `<div class="typebox"><input id="i1" placeholder="Simple past" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><input id="i2" placeholder="Past participle" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></div><div class="typebox"><button class="btn primary" id="go" style="flex:1">OK</button></div>${G.level === 'mittel' ? '<button class="btn" id="tip">💡 Tipp (−Punkte)</button>' : ''}`;
    const i1 = $('#i1'), i2 = $('#i2'), hint = n => { i1.placeholder = [...answer[0]][0] + ' …'; i2.placeholder = [...answer[1]][0] + ' …'; };
    if (G.level === 'leicht') hint(); if ($('#tip')) $('#tip').onclick = () => { q.hints++; hint(); sfx('tap'); };
    const submit = () => { if (G.busy || !i1.value.trim() || !i2.value.trim()) return; const r = [judge(i1.value, answer[0], !mid), judge(i2.value, answer[1], !mid)]; resolve(r.includes('bad') ? 'bad' : r.includes('close') ? 'close' : 'ok', `${i1.value} · ${i2.value}`); };
    $('#go').onclick = submit; [i1, i2].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') submit(); });
    if (!matchMedia('(pointer:coarse)').matches) i1.focus(); return;
  }
  if (G.level === 'leicht') {
    const key = to === 'en' ? 'en' : 'de';
    const pool = [...new Set([...db.cards.map(c => c[key]), ...STARTER.map(s => s[to === 'en' ? 0 : 1])])].filter(x => strip(x) !== strip(answer));
    const opts = shuffle([answer, ...shuffle(pool).slice(0, 3)]);
    area.innerHTML = `<div class="choices">${opts.map(o => `<button class="choice">${esc(o)}</button>`).join('')}</div>`;
    $$('.choice', area).forEach(b => b.onclick = () => { if (G.busy) return; $$('.choice', area).forEach(x => x.disabled = true); const ok = b.textContent === answer; b.classList.add(ok ? 'ok' : 'no'); if (!ok) $$('.choice', area).find(x => x.textContent === answer).classList.add('ok'); resolve(ok ? 'ok' : 'bad'); });
  } else {
    const mid = G.level === 'mittel';
    area.innerHTML = `${mid ? '<div class="pattern" id="pat"></div>' : ''}<div class="typebox"><input id="inp" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${to === 'en' ? 'Auf Englisch …' : 'Auf Deutsch …'}"><button class="btn primary" id="go">OK</button></div>
      ${mid ? '<button class="btn" id="tip">💡 Tipp (−Punkte)</button>' : ''}`;
    const inp = $('#inp'); if (mid) { drawPattern(answer, 1); $('#tip').onclick = () => { q.hints++; drawPattern(answer, 1 + q.hints); sfx('tap'); inp.focus(); }; }
    const submit = () => { if (G.busy || !inp.value.trim()) return; resolve(judge(inp.value, answer, !mid), inp.value); };
    $('#go').onclick = submit; inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
    if (!matchMedia('(pointer:coarse)').matches) inp.focus();
  }
}
function drawPattern(ans, n) { let shown = 0; $('#pat').textContent = [...ans].map(ch => ch === ' ' ? '  ' : /[a-zäöüß]/i.test(ch) ? (shown++ < n ? ch : '_') : ch).join(' '); }

let tInt;
function startTimer(sec) {
  const el = $('#timer'), bar = $('i', el); el.hidden = false; const t0 = performance.now(); G.t0 = t0;
  clearInterval(tInt); tInt = setInterval(() => { const p = 1 - (performance.now() - t0) / (sec * 1000); bar.style.width = Math.max(0, p * 100) + '%'; if (p <= 0) { clearInterval(tInt); if (!G.busy) resolve('bad', '', true); } }, 80);
}
function stopTimer() { clearInterval(tInt); }

async function resolve(res, input = '', timeout = false) {
  if (G.busy) return; G.busy = true; stopTimer();
  const q = G.q, c = q.c, ok = res === 'ok' || res === 'close';
  const quick = G.t0 && G.level === 'schwer' ? Math.max(0, 1 - (performance.now() - G.t0) / (LV.schwer.time * 1000)) : 0;
  let gain = 0;
  if (ok) { G.combo++; G.best = Math.max(G.best, G.combo); G.right++; gain = Math.round((LV[G.level].pts - q.hints * 6 + quick * 15) * (res === 'close' ? .6 : 1) * (1 + Math.min(G.combo - 1, 5) * .2)); gain = Math.max(3, gain); G.score += gain; db.xp += gain; c.ok++; c.box = Math.min(4, c.box + (res === 'close' ? 0 : 1)); }
  else { G.combo = 0; G.wrong.push(c); c.bad++; c.box = Math.max(0, c.box - 1); }
  save(); refresh(); $('#score').textContent = G.score; $('#combo').textContent = G.combo;
  const back = $('#back'); back.classList.add(ok ? 'good' : 'bad');
  $('#verdict').textContent = res === 'ok' ? '✅ Richtig!' : res === 'close' ? '👍 Fast – knapp daneben' : timeout ? '⏰ Zeit um!' : '❌ Leider falsch';
  $('#ans-sub').textContent = ok ? `+${gain} ⭐${G.combo > 1 ? ' · Combo x' + G.combo : ''}` : (input ? `Du: ${input}` : '');
  setTimeout(() => { flip.classList.add('on'); sfx(ok ? 'ok' : 'bad'); }, 250);
  await wait(700); fl.classList.add(ok ? 'win' : 'shake'); if (ok && G.combo >= 3) confetti(30);
  // Aussprache: Englisches Wort nach der Antwort vorlesen (bei DE→EN)
  if (q.dir === 'de-en' && db.set.autospeak) setTimeout(() => speak(c.en, 'en'), 300);
  if (q.dir === 'forms' && db.set.autospeak) setTimeout(() => speak(`${c.en}, ${c.forms.join(', ')}`, 'en'), 300);
  $('#answer-area').innerHTML = `<button class="btn primary next" id="next">${G.i + 1 >= G.queue.length ? '🏁 Fertig' : 'Weiter ▶'}</button>`;
  $('#next').onclick = async () => { $('#next').disabled = true; fl.className = 'float out'; sfx('flip'); await wait(420); G.i++; nextQ(); };
  $('#next').focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && G && $('#v-game') && !$('#v-game').hidden) { const n = $('#next'); if (n && !n.disabled) n.click(); } });
$('#quit').onclick = () => { if (confirm('Runde beenden?')) { speechSynthesis && speechSynthesis.cancel(); show('home'); } };

function endGame() {
  const total = G.queue.length, pct = G.right / total, stars = pct >= .9 ? 3 : pct >= .6 ? 2 : pct > 0 ? 1 : 0;
  const today = new Date().toDateString();
  if (db.lastDay !== today) { const y = new Date(Date.now() - 864e5).toDateString(); db.streak = db.lastDay === y ? db.streak + 1 : 1; db.lastDay = today; }
  save(); refresh(); show('result');
  $('#stars').innerHTML = [0, 1, 2].map(i => `<span style="animation-delay:${i * .25}s;opacity:${i < stars ? 1 : .2}">⭐</span>`).join('');
  $('#res-title').textContent = pct === 1 ? 'PERFEKT! 🏆' : pct >= .6 ? 'Stark gespielt! 💪' : 'Weiter üben – du schaffst das! 🌱';
  $('#res-sub').textContent = `${G.right} von ${total} richtig · +${G.score} ⭐ · beste Combo x${G.best}`;
  $('#res-wrong').innerHTML = G.wrong.length ? '<h3>Nochmal anschauen:</h3>' + G.wrong.map(c => `<div class="wr"><b>${esc(c.en)}</b><span>${esc(c.de)}</span></div>`).join('') : '';
  $('#again-wrong').hidden = !G.wrong.length;
  if (stars >= 2) { sfx('win'); confetti(120); }
  G.done = true;
}
$('#again').onclick = () => startGame();
$('#again-wrong').onclick = () => startGame([...G.wrong]);

/* ---------- 3D-Karte: Neigung + Hologlanz ---------- */
function tiltMove(e) {
  const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  const cx = Math.max(0, Math.min(1, x)), cy = Math.max(0, Math.min(1, y));
  tilt.classList.remove('rest');
  tilt.style.setProperty('--ry', ((cx - .5) * 36).toFixed(1) + 'deg'); tilt.style.setProperty('--rx', ((.5 - cy) * 28).toFixed(1) + 'deg');
  for (const f of [$('#front'), $('#back')]) { f.style.setProperty('--mx', (cx * 100) + '%'); f.style.setProperty('--my', (cy * 100) + '%'); }
}
function tiltEnd() { tilt.classList.add('rest'); tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); }
stage.addEventListener('pointermove', tiltMove); stage.addEventListener('pointerleave', tiltEnd); stage.addEventListener('pointerup', e => { if (e.pointerType === 'touch') setTimeout(tiltEnd, 400); });
// Handy-Neigung (wo erlaubt)
window.addEventListener('deviceorientation', e => { if (!G || $('#v-game').hidden || e.gamma == null) return; const g = Math.max(-25, Math.min(25, e.gamma)), b = Math.max(-25, Math.min(25, (e.beta || 45) - 45)); tilt.classList.remove('rest'); tilt.style.setProperty('--ry', g * .8 + 'deg'); tilt.style.setProperty('--rx', -b * .6 + 'deg'); for (const f of [$('#front'), $('#back')]) { f.style.setProperty('--mx', (50 + g * 2) + '%'); f.style.setProperty('--my', (50 + b * 2) + '%'); } });

/* ---------- Konfetti ---------- */
const fx = $('#fx'), fxc = fx.getContext('2d'); let parts = [], raf;
function sizeFx() { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; } sizeFx(); addEventListener('resize', sizeFx);
function confetti(n = 90) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const d = devicePixelRatio, cols = ['#ffd23f', '#ff4fa3', '#3de1ff', '#35e08a', '#7c5cff', '#ff8a3d'];
  for (let i = 0; i < n; i++)parts.push({ x: fx.width / 2, y: fx.height * .45, vx: (Math.random() - .5) * 14 * d, vy: (-Math.random() * 14 - 4) * d, s: (4 + Math.random() * 6) * d, c: cols[rnd(6)], r: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1 });
  if (!raf) raf = requestAnimationFrame(loop);
}
function loop() {
  fxc.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 40);
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .5 * devicePixelRatio; p.vx *= .99; p.r += p.vr; p.life -= .006; fxc.save(); fxc.globalAlpha = Math.max(0, p.life); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.fillStyle = p.c; fxc.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); fxc.restore(); }
  raf = parts.length ? requestAnimationFrame(loop) : null;
}

/* ---------- Start ---------- */
if (profiles.length === 1) login(profiles[0].id); else { refresh(); show('profiles'); }
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
