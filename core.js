/* =========================================================================
   Fitness – Kernlogik
   Reine Funktionen ohne Bildschirm-Bezug: Datum, Zahlen, Trainings,
   Auswertung, Export/Import. Läuft im Browser und in Node (für Tests).
   ========================================================================= */
(function (root) {
  'use strict';

  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var MAX_SETS = 6;

  // Unterkörper-Tag (ab Version 2 dazugekommen)
  var LOWER_BODY = [
    ['kniebeugen', 'Kniebeugen', 'weight', 'B'],
    ['wadenheben', 'Wadenheben', 'weight', 'B'],
    ['schienbein', 'Schienbeinheben', 'body', 'B'],
    ['hipthrust', 'Hip Thrusts', 'weight', 'B'],
    ['abduktoren', 'Abduktoren', 'weight', 'B'],
    ['adduktoren', 'Adduktoren', 'weight', 'B']
  ];
  var DAY_NAMES = { A: 'Oberkörper', B: 'Unterkörper' };

  // Startliste nach der Papierkarte. type: 'weight' = mit Zusatzgewicht,
  // 'body' = Körpergewicht (Gewicht kann trotzdem eingetragen werden).
  // days: an welchem Trainingstag des Zweier-Splits die Übung dran ist
  // ('A' = Oberkörper, 'B' = Unterkörper).
  var DEFAULT_EXERCISES = [
    ['latzug', 'Latzug', 'weight', 'A'],
    ['rudern', 'Rudern', 'weight', 'A'],
    ['bizeps', 'Bizepscurls KH', 'weight', 'A'],
    ['schulter', 'Schulterdrücken', 'weight', 'A'],
    ['seitheben', 'Seitheben KH', 'weight', 'A'],
    ['trizeps', 'Trizeps gr. M.', 'weight', 'A'],
    ['ruecken', 'Unterer Rücken', 'body', 'A'],
    ['bauch-seitl', 'Bauch seitlich', 'body', 'A'],
    ['nacken', 'Nacken', 'body', 'A']
  ].concat(LOWER_BODY, [['bauch', 'Bauch', 'body', 'AB']]);

  // ------------------------------------------------------------ Datum

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseKey(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getMonth() !== +m[2] - 1) return null;
    return d;
  }

  function isValidKey(key) { return parseKey(key) !== null; }

  function todayKey() { return dateKey(new Date()); }

  function addMonths(key, n) {
    var d = parseKey(key);
    d.setMonth(d.getMonth() + n);
    return dateKey(d);
  }

  // Ganze Tage von a bis b (b - a), unabhängig von Sommer-/Winterzeit
  function daysBetween(a, b) {
    var da = parseKey(a), db = parseKey(b);
    return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
      Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 864e5);
  }

  function addDays(key, n) {
    var d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  function formatDate(key, style) {
    var d = parseKey(key);
    if (!d) return '';
    var dm = pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.';
    if (style === 'dm') return dm;
    if (style === 'short') return WD[d.getDay()] + ' ' + dm + String(d.getFullYear()).slice(2);
    return WD[d.getDay()] + ', ' + dm + d.getFullYear();
  }

  function formatTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // ------------------------------------------------------------ Zahlen

  // Deutsches Format: Komma als Dezimaltrennzeichen, keine unnötigen Nullen.
  function fmtNum(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    var r = Math.round(n * 100) / 100;
    return String(r).replace('.', ',');
  }

  function parseNum(str) {
    if (typeof str === 'number') return isFinite(str) ? str : null;
    if (typeof str !== 'string') return null;
    var s = str.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  }

  function roundTo(n, step) { return Math.round(n / step) * step; }

  // ------------------------------------------------------------ Zustand

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function defaultSettings() {
    return {
      theme: 'dark', restSec: 90, lastBackup: null, split: true,
      // Gym-Ziel: Anzahl Besuche (= Trainingstage) im Zeitraum
      goal: { on: true, target: 75, start: '2026-10-07', end: '2027-03-31' }
    };
  }

  function defaultState() {
    return {
      version: 2,
      exercises: DEFAULT_EXERCISES.map(function (e) {
        return { id: e[0], name: e[1], type: e[2], sets: 3, hidden: false, days: e[3].split('') };
      }),
      trainings: [],
      settings: defaultSettings()
    };
  }

  function isSetValue(v) { return v === null || v === true || (typeof v === 'number' && isFinite(v) && v >= 0); }

  function cleanNum(v, max) {
    var n = parseNum(v);
    if (n === null || n < 0 || n > max) return null;
    return Math.round(n * 100) / 100;
  }

  // Prüft und bereinigt einen geladenen oder importierten Zustand.
  // Unbekanntes wird verworfen, kaputte Einträge übersprungen.
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Keine gültigen Daten.');
    var out = defaultState();
    if (Array.isArray(raw.exercises)) {
      var seen = {};
      out.exercises = [];
      raw.exercises.forEach(function (e) {
        if (!e || typeof e.id !== 'string' || !e.id || seen[e.id]) return;
        var name = typeof e.name === 'string' ? e.name.trim().slice(0, 40) : '';
        if (!name) return;
        seen[e.id] = true;
        var sets = parseInt(e.sets, 10);
        out.exercises.push({
          id: e.id.slice(0, 60),
          name: name,
          type: e.type === 'body' ? 'body' : 'weight',
          sets: sets >= 1 && sets <= MAX_SETS ? sets : 3,
          hidden: !!e.hidden,
          days: cleanDays(e.days)
        });
      });
      // Umstellung auf Version 2 (Zweier-Split): Unterkörper-Übungen ergänzen,
      // Bauch an beiden Tagen. Bisherige Übungen gehören zum Oberkörper-Tag.
      if (!(raw.version >= 2)) {
        // Bauch ans Ende, damit er an beiden Tagen als letzte Übung kommt
        var bauch = null;
        out.exercises = out.exercises.filter(function (e) {
          if (e.id === 'bauch') { bauch = e; return false; }
          return true;
        });
        LOWER_BODY.forEach(function (d) {
          if (!seen[d[0]]) out.exercises.push({ id: d[0], name: d[1], type: d[2], sets: 3, hidden: false, days: ['B'] });
        });
        if (bauch) bauch.days = ['A', 'B'];
        else bauch = { id: 'bauch', name: 'Bauch', type: 'body', sets: 3, hidden: false, days: ['B'] };
        out.exercises.push(bauch);
      }
    }
    var exIds = {};
    out.exercises.forEach(function (e) { exIds[e.id] = true; });

    if (Array.isArray(raw.trainings)) {
      var byDate = {};
      raw.trainings.forEach(function (t) {
        if (!t || !isValidKey(t.date) || byDate[t.date]) return;
        var entries = {};
        if (t.entries && typeof t.entries === 'object') {
          Object.keys(t.entries).forEach(function (exId) {
            if (!exIds[exId]) return;
            var en = t.entries[exId] || {};
            var sets = Array.isArray(en.sets) ? en.sets.slice(0, MAX_SETS).map(function (v) {
              if (v === true) return true;
              return cleanNum(v, 999);
            }) : [];
            var entry = {
              weight: cleanNum(en.weight, 999),
              sets: sets,
              note: typeof en.note === 'string' ? en.note.slice(0, 500) : ''
            };
            if (hasData(entry)) entries[exId] = entry;
          });
        }
        var tr = {
          id: typeof t.id === 'string' && t.id ? t.id : uid('t'),
          date: t.date,
          createdAt: typeof t.createdAt === 'string' && !isNaN(new Date(t.createdAt)) ? t.createdAt : null,
          bodyweight: cleanNum(t.bodyweight, 400),
          day: t.day === 'A' || t.day === 'B' ? t.day : null,
          entries: entries
        };
        if (!trainingIsEmpty(tr)) { byDate[t.date] = true; out.trainings.push(tr); }
      });
    }
    sortTrainings(out.trainings);

    if (raw.settings && typeof raw.settings === 'object') {
      var s = raw.settings;
      if (s.theme === 'light' || s.theme === 'dark') out.settings.theme = s.theme;
      var rest = parseInt(s.restSec, 10);
      if ([0, 60, 90, 120, 180].indexOf(rest) >= 0) out.settings.restSec = rest;
      if (typeof s.lastBackup === 'string') out.settings.lastBackup = s.lastBackup;
      if (s.split === false) out.settings.split = false;
      if (s.goal && typeof s.goal === 'object') {
        var g = s.goal, tg = parseInt(g.target, 10);
        if (tg >= 1 && tg <= 1000 && isValidKey(g.start) && isValidKey(g.end) && g.end > g.start) {
          out.settings.goal = { on: g.on !== false, target: tg, start: g.start, end: g.end };
        } else if (g.on === false) out.settings.goal.on = false;
      }
    }
    return out;
  }

  // ------------------------------------------------------------ Trainings

  function sortTrainings(list) {
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return list;
  }

  function hasData(entry) {
    if (!entry) return false;
    return entry.weight !== null && entry.weight !== undefined ||
      (entry.sets || []).some(function (v) { return v !== null && v !== undefined; }) ||
      !!(entry.note && entry.note.trim());
  }

  function entryDone(entry) {
    return !!entry && (entry.sets || []).some(function (v) { return v !== null && v !== undefined; });
  }

  function trainingIsEmpty(t) {
    return !t || (t.bodyweight === null || t.bodyweight === undefined) &&
      !Object.keys(t.entries || {}).some(function (k) { return hasData(t.entries[k]); });
  }

  function getTraining(state, date) {
    for (var i = 0; i < state.trainings.length; i++) {
      if (state.trainings[i].date === date) return state.trainings[i];
    }
    return null;
  }

  function ensureTraining(state, date, nowIso) {
    var t = getTraining(state, date);
    if (t) return t;
    t = { id: uid('t'), date: date, createdAt: nowIso || new Date().toISOString(), bodyweight: null, day: null, entries: {} };
    state.trainings.push(t);
    sortTrainings(state.trainings);
    return t;
  }

  function ensureEntry(training, exId) {
    if (!training.entries[exId]) training.entries[exId] = { weight: null, sets: [], note: '' };
    return training.entries[exId];
  }

  // Entfernt leere Einträge und – falls nichts übrig bleibt – das Training.
  function tidyTraining(state, date) {
    var t = getTraining(state, date);
    if (!t) return;
    Object.keys(t.entries).forEach(function (k) {
      var e = t.entries[k];
      while (e.sets.length && (e.sets[e.sets.length - 1] === null || e.sets[e.sets.length - 1] === undefined)) e.sets.pop();
      if (!hasData(e)) delete t.entries[k];
    });
    if (trainingIsEmpty(t)) state.trainings.splice(state.trainings.indexOf(t), 1);
  }

  // Laufende Nummer: Trainings werden nach Datum durchgezählt, beginnend bei 1.
  // Für einen Tag ohne Training gilt die Nummer, die er bekäme.
  function trainingNumber(state, date) {
    var n = 1;
    state.trainings.forEach(function (t) { if (t.date < date) n++; });
    return n;
  }

  function cleanDays(d) {
    if (!Array.isArray(d)) return ['A'];
    var out = ['A', 'B'].filter(function (k) { return d.indexOf(k) >= 0; });
    return out.length ? out : ['A'];
  }

  // Trainingstag eines Trainings. Ältere Trainings ohne Angabe: Unterkörper,
  // wenn eine reine Unterkörper-Übung drin ist, sonst Oberkörper.
  function trainingDay(state, t) {
    if (t.day) return t.day;
    var b = Object.keys(t.entries).some(function (k) {
      var ex = findExercise(state, k);
      return ex && ex.days.length === 1 && ex.days[0] === 'B';
    });
    return b ? 'B' : 'A';
  }

  // Vorschlag für einen Tag ohne Training: abwechselnd zum letzten Training davor.
  function suggestDay(state, date) {
    for (var i = state.trainings.length - 1; i >= 0; i--) {
      if (state.trainings[i].date < date) return trainingDay(state, state.trainings[i]) === 'A' ? 'B' : 'A';
    }
    return 'A';
  }

  function findExercise(state, id) {
    for (var i = 0; i < state.exercises.length; i++) if (state.exercises[i].id === id) return state.exercises[i];
    return null;
  }

  // Letzter Eintrag einer Übung vor einem Datum (für Vorbelegung und "zuletzt").
  function lastEntryBefore(state, exId, date) {
    for (var i = state.trainings.length - 1; i >= 0; i--) {
      var t = state.trainings[i];
      if (t.date >= date) continue;
      var e = t.entries[exId];
      if (e && (entryDone(e) || e.weight !== null)) return { training: t, entry: e };
    }
    return null;
  }

  function lastBodyweightBefore(state, date) {
    for (var i = state.trainings.length - 1; i >= 0; i--) {
      var t = state.trainings[i];
      if (t.date < date && t.bodyweight !== null && t.bodyweight !== undefined) return t.bodyweight;
    }
    return null;
  }

  function setCount(ex, entry) {
    var n = ex ? ex.sets : 3;
    if (entry && entry.sets.length > n) n = entry.sets.length;
    return Math.min(n, MAX_SETS);
  }

  function setLabel(v) {
    if (v === true) return '✓';
    if (v === null || v === undefined) return '';
    return fmtNum(v);
  }

  function entrySummary(entry) {
    var parts = [];
    if (entry.weight !== null && entry.weight !== undefined) parts.push(fmtNum(entry.weight) + ' kg');
    var sets = entry.sets.filter(function (v) { return v !== null && v !== undefined; }).map(setLabel);
    if (sets.length) parts.push(sets.join(' · '));
    return parts.join('  ·  ');
  }

  // ------------------------------------------------------------ Auswertung

  function rangeStart(range, today) {
    if (range === '3m') return addMonths(today, -3);
    if (range === '6m') return addMonths(today, -6);
    if (range === '1y') return addMonths(today, -12);
    return '0000-00-00';
  }

  // Ein Punkt je Training: Datum, Nummer, Gewicht, Wiederholungen je Satz.
  function exerciseSeries(state, exId, fromKey) {
    var rows = [];
    var maxSets = 0;
    state.trainings.forEach(function (t, i) {
      if (t.date < fromKey) return;
      var e = t.entries[exId];
      if (!e || !hasData(e)) return;
      var ys = e.sets.map(function (v) { return typeof v === 'number' ? v : null; });
      ys.forEach(function (v, k) { if (v !== null && k + 1 > maxSets) maxSets = k + 1; });
      rows.push({ date: t.date, nr: i + 1, weight: e.weight, sets: e.sets.slice(), ys: ys, note: e.note });
    });
    return { rows: rows, maxSets: maxSets };
  }

  function bodySeries(state, fromKey) {
    var rows = [];
    state.trainings.forEach(function (t, i) {
      if (t.date < fromKey || t.bodyweight === null || t.bodyweight === undefined) return;
      rows.push({ date: t.date, nr: i + 1, ys: [t.bodyweight] });
    });
    return { rows: rows, maxSets: rows.length ? 1 : 0 };
  }

  // ------------------------------------------------------------ Gym-Ziel

  // Fortschritt zum Ziel „X Besuche von Start bis Ende“. Jeder Tag mit einem
  // Training zählt als Besuch. Das Soll wächst gleichmäßig über den Zeitraum;
  // verglichen wird mit dem Soll bis einschließlich gestern, damit man morgens
  // nicht schon „hinten“ liegt, bevor man überhaupt trainieren konnte.
  function goalStatus(state, today) {
    var g = state.settings.goal;
    if (!g || !g.on) return null;
    var total = daysBetween(g.start, g.end) + 1;
    var dates = state.trainings.map(function (t) { return t.date; })
      .filter(function (d) { return d >= g.start && d <= g.end && d <= today; });
    var count = dates.length;
    var trainedToday = dates.indexOf(today) >= 0;
    var phase = today < g.start ? 'before' : today > g.end ? 'after' : 'running';

    var daysBefore = Math.min(Math.max(daysBetween(g.start, today), 0), total);
    var expected = g.target * daysBefore / total;
    var diff = count - expected;
    var status = diff >= 0.5 ? 'ahead' : diff > -0.5 ? 'ontrack' : 'behind';

    var remaining = Math.max(g.target - count, 0);
    var firstOpen = trainedToday ? addDays(today, 1) : today;
    if (firstOpen < g.start) firstOpen = g.start;
    var daysLeft = Math.max(daysBetween(firstOpen, g.end) + 1, 0);
    var perWeek = remaining && daysLeft ? remaining / (daysLeft / 7) : 0;

    // Montag der laufenden Woche
    var wd = (parseKey(today).getDay() + 6) % 7;
    var monday = addDays(today, -wd);
    var weekCount = dates.filter(function (d) { return d >= monday; }).length;

    return {
      target: g.target, start: g.start, end: g.end, total: total, phase: phase,
      count: count, expected: expected, diff: diff, status: status,
      ahead: Math.round(Math.abs(diff)), remaining: remaining, daysLeft: daysLeft,
      perWeek: perWeek, weekCount: weekCount, reached: count >= g.target, dates: dates
    };
  }

  // ------------------------------------------------------------ Export / Import

  function buildExport(state) {
    return {
      app: 'fitness',
      version: 2,
      exportedAt: new Date().toISOString(),
      exercises: state.exercises,
      trainings: state.trainings,
      settings: state.settings
    };
  }

  function parseImport(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error('Die Datei ist keine gültige Sicherung (kein JSON).'); }
    if (!raw || raw.app !== 'fitness') throw new Error('Die Datei ist keine Sicherung dieser App.');
    return sanitizeState(raw);
  }

  // CSV für Excel: Semikolon als Trenner, Komma als Dezimalzeichen, UTF-8 mit BOM.
  function toCsv(state) {
    var maxSets = 3;
    state.trainings.forEach(function (t) {
      Object.keys(t.entries).forEach(function (k) {
        if (t.entries[k].sets.length > maxSets) maxSets = t.entries[k].sets.length;
      });
    });
    function q(s) {
      s = String(s === null || s === undefined ? '' : s);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var head = ['Training', 'Datum', 'Beginn', 'Trainingstag', 'Übung', 'Gewicht (kg)'];
    for (var i = 1; i <= maxSets; i++) head.push('Satz ' + i);
    head.push('Notiz', 'Körpergewicht (kg)');
    var lines = [head.map(q).join(';')];
    state.trainings.forEach(function (t, idx) {
      var d = parseKey(t.date);
      var datum = pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
      var beginn = t.createdAt && dateKey(new Date(t.createdAt)) === t.date ? formatTime(t.createdAt) : '';
      var order = state.exercises.map(function (e) { return e.id; });
      var keys = Object.keys(t.entries).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      if (!keys.length) keys = [null];
      keys.forEach(function (k) {
        var ex = k ? findExercise(state, k) : null;
        var e = k ? t.entries[k] : { weight: null, sets: [], note: '' };
        var row = [idx + 1, datum, beginn, state.settings.split === false ? '' : DAY_NAMES[trainingDay(state, t)], ex ? ex.name : '', fmtNum(e.weight)];
        for (var s = 0; s < maxSets; s++) row.push(e.sets[s] === true ? 'x' : fmtNum(e.sets[s]));
        row.push(e.note || '', fmtNum(t.bodyweight));
        lines.push(row.map(q).join(';'));
      });
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function makeExerciseId(name, state) {
    var base = name.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'uebung';
    var id = base, n = 2;
    while (findExercise(state, id)) id = base + '-' + n++;
    return id;
  }

  var api = {
    WD: WD, MAX_SETS: MAX_SETS,
    pad2: pad2, dateKey: dateKey, parseKey: parseKey, isValidKey: isValidKey, todayKey: todayKey,
    addMonths: addMonths, addDays: addDays, daysBetween: daysBetween, formatDate: formatDate, formatTime: formatTime,
    fmtNum: fmtNum, parseNum: parseNum, roundTo: roundTo,
    DAY_NAMES: DAY_NAMES, trainingDay: trainingDay, suggestDay: suggestDay,
    uid: uid, defaultState: defaultState, sanitizeState: sanitizeState,
    hasData: hasData, entryDone: entryDone, trainingIsEmpty: trainingIsEmpty,
    getTraining: getTraining, ensureTraining: ensureTraining, ensureEntry: ensureEntry, tidyTraining: tidyTraining,
    trainingNumber: trainingNumber, findExercise: findExercise,
    lastEntryBefore: lastEntryBefore, lastBodyweightBefore: lastBodyweightBefore,
    setCount: setCount, setLabel: setLabel, entrySummary: entrySummary,
    rangeStart: rangeStart, goalStatus: goalStatus, exerciseSeries: exerciseSeries, bodySeries: bodySeries,
    buildExport: buildExport, parseImport: parseImport, toCsv: toCsv, makeExerciseId: makeExerciseId
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FitCore = api;
})(this);
