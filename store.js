/* Datenbank dieses Geräts (IndexedDB) – speichert automatisch, nichts verlässt das Gerät.
   Fällt auf localStorage zurück, falls der Browser IndexedDB sperrt (z. B. privater Modus). */
(function () {
  'use strict';
  var NAME = 'vokabelarena-db', ST = 'kv', mem = {}, idb = null;
  function openDB() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(NAME, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function loadAll(d) {
    return new Promise(function (res) {
      var out = {};
      try {
        var rq = d.transaction(ST, 'readonly').objectStore(ST).openCursor();
        rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
        rq.onerror = function () { res(out); };
      } catch (e) { res(out); }
    });
  }
  function put(k, v) { try { idb.transaction(ST, 'readwrite').objectStore(ST).put(v, k); } catch (e) { } }
  var STORE = window.STORE = {
    mode: 'localStorage', persistent: false,
    get: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    set: function (k, v) { mem[k] = v; if (idb) put(k, v); else try { localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { delete mem[k]; if (idb) { try { idb.transaction(ST, 'readwrite').objectStore(ST).delete(k); } catch (e) { } } else try { localStorage.removeItem(k); } catch (e) { } }
  };
  function start() {
    var a = document.createElement('script'); a.src = 'slang.js';
    a.onload = a.onerror = function () { var s = document.createElement('script'); s.src = 'app.js'; document.body.appendChild(s); };
    document.body.appendChild(a);
  }
  openDB().then(function (d) {
    idb = d;
    if (idb) {
      STORE.mode = 'IndexedDB';
      return loadAll(idb).then(function (all) {
        mem = all;
        // einmalig: alte Daten aus localStorage in die Datenbank übernehmen
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf('vokabelarena') === 0 && !(k in mem)) { mem[k] = localStorage.getItem(k); put(k, mem[k]); }
          }
        } catch (e) { }
      });
    }
    try { for (var j = 0; j < localStorage.length; j++) { var kk = localStorage.key(j); if (kk && kk.indexOf('vokabelarena') === 0) mem[kk] = localStorage.getItem(kk); } } catch (e) { }
  }).then(function () {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (ok) { STORE.persistent = !!ok; }); } catch (e) { }
  }).then(start, start);
})();
