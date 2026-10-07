/* =========================================================================
   Fitness – Bedienoberfläche
   Speichert ausschließlich lokal (localStorage). Keine Netzwerkzugriffe.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.FitCore;
  var APP_VERSION = '1';
  var KEY = 'fitness.v1';
  var KEY_UNDO = 'fitness.undoImport';

  var state;
  var curDate = C.todayKey();       // angezeigtes Training
  var statSel = null;               // gewählte Übung in der Analyse
  var statRange = 'all';
  var storageBroken = false;

  function $(id) { return document.getElementById(id); }

  // Kleiner Helfer zum Bauen von Elementen. Texte immer über textContent,
  // damit Übungsnamen nie als HTML interpretiert werden.
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // ------------------------------------------------------------ Speichern

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? C.sanitizeState(JSON.parse(raw)) : C.defaultState();
    } catch (e) {
      state = C.defaultState();
      storageBroken = true;
    }
  }

  var persistAsked = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      toast('Speichern fehlgeschlagen – Speicher voll oder gesperrt.', true);
      return;
    }
    // Einmalig um dauerhaften Speicher bitten, damit Android die Daten
    // nicht bei Platzmangel aufräumt.
    if (!persistAsked && navigator.storage && navigator.storage.persist) {
      persistAsked = true;
      navigator.storage.persist().catch(function () {});
    }
  }

  // ------------------------------------------------------------ Kleinkram

  var toastTimer;
  function toast(msg, isError) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.toggle('is-error', !!isError);
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function visibleExercises(training) {
    return state.exercises.filter(function (e) {
      return !e.hidden || (training && training.entries[e.id]);
    });
  }

  // ------------------------------------------------------------ Dialoge

  var dlg = $('dlg');
  function openDialog(nodes) {
    dlg.textContent = '';
    nodes.forEach(function (n) { if (n) dlg.appendChild(n); });
    if (!dlg.open) dlg.showModal();
    // Fokus auf die Überschrift, damit sich die Tastatur nicht ungefragt öffnet
    var head = dlg.querySelector('h2');
    if (head) { head.tabIndex = -1; head.focus(); }
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  // Tippen neben den Dialog schließt ihn (nicht aber ins Innenpolster)
  dlg.addEventListener('click', function (e) {
    if (e.target !== dlg) return;
    var r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });

  function confirmDialog(title, text, okLabel, onOk, danger) {
    openDialog([
      h('h2', { text: title }),
      h('p', { text: text }),
      h('div', { class: 'dlg-row dlg-actions' }, [
        h('button', { class: 'btn', text: 'Abbrechen', onclick: closeDialog }),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: okLabel, onclick: function () { closeDialog(); onOk(); } })
      ])
    ]);
  }

  // ------------------------------------------------------------ Navigation

  var currentView = 'train';
  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('is-active', v.id === 'view-' + name); });
    document.querySelectorAll('.nav button').forEach(function (b) {
      if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.nav button').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.dataset.view); });
  });

  function render() {
    if (currentView === 'train') renderTrain();
    else if (currentView === 'stats') renderStats();
    else renderMore();
    $('moreBadge').hidden = !backupDue();
  }

  // ================================================================ TRAINING

  function renderTrain() {
    var today = C.todayKey();
    var t = C.getTraining(state, curDate);
    var isToday = curDate === today;

    $('trKicker').textContent = isToday ? 'Heute' : curDate < today ? 'Früheres Training' : 'Vorausplanung';
    $('trNum').textContent = C.trainingNumber(state, curDate);
    var sub = C.formatDate(curDate, 'long');
    if (t && t.createdAt && C.dateKey(new Date(t.createdAt)) === t.date) sub += ' · Beginn ' + C.formatTime(t.createdAt);
    $('trSub').textContent = sub;
    $('trToday').hidden = isToday;
    $('trDate').value = curDate;
    $('trDelete').hidden = !t;

    var bw = t ? t.bodyweight : null;
    var bwEl = $('bwVal');
    bwEl.textContent = bw !== null ? C.fmtNum(bw) + ' kg' : 'eintragen';
    bwEl.classList.toggle('is-empty', bw === null);

    var list = $('exList');
    list.textContent = '';
    var exs = visibleExercises(t);
    if (!exs.length) {
      list.appendChild(h('div', { class: 'empty' }, [
        h('h2', { text: 'Keine Übungen' }),
        h('p', { text: 'Lege unter Einstellungen deine Übungen an.' })
      ]));
      return;
    }
    exs.forEach(function (ex) { list.appendChild(exerciseCard(ex, t)); });
  }

  function exerciseCard(ex, t) {
    var entry = t ? t.entries[ex.id] : null;
    var last = C.lastEntryBefore(state, ex.id, curDate);
    var n = C.setCount(ex, entry);
    var done = C.entryDone(entry);

    var grid = h('div', { class: 'ex-grid', style: '--cols:' + n });

    // Gewicht
    var w = entry ? entry.weight : null;
    var ghostW = last && last.entry.weight !== null ? last.entry.weight : null;
    var wVal;
    if (w !== null) wVal = h('span', { class: 'v', text: C.fmtNum(w) });
    else if (ghostW !== null && ex.type === 'weight') wVal = h('span', { class: 'v is-ghost', text: C.fmtNum(ghostW) });
    else wVal = h('span', { class: 'v is-ghost', text: '–' });
    grid.appendChild(h('button', {
      class: 'cell cell-w' + (w !== null ? ' is-filled' : ''),
      'aria-label': ex.name + ' Gewicht',
      onclick: function () { openPad({ kind: 'w', exId: ex.id }); }
    }, [wVal, h('small', { text: w === null && ex.type === 'body' ? 'ohne' : 'kg' })]));

    // Sätze
    for (var i = 0; i < n; i++) {
      (function (i) {
        var v = entry ? entry.sets[i] : null;
        var has = v !== null && v !== undefined;
        var ghost = last ? last.entry.sets[i] : null;
        var span;
        if (has) span = h('span', { class: 'v' + (v === true ? ' is-check' : ''), text: C.setLabel(v) });
        else span = h('span', { class: 'v is-ghost', text: ghost !== null && ghost !== undefined ? C.setLabel(ghost) : '' });
        grid.appendChild(h('button', {
          class: 'cell' + (has ? ' is-filled' : ''),
          'aria-label': ex.name + ' Satz ' + (i + 1),
          onclick: function () { openPad({ kind: 's', exId: ex.id, idx: i }); }
        }, [h('small', { text: 'Satz ' + (i + 1) }), span]));
      })(i);
    }

    grid.appendChild(h('button', {
      class: 'cell cell-add', 'aria-label': 'Satz hinzufügen', text: '+',
      disabled: n >= C.MAX_SETS ? true : null,
      onclick: function () { openPad({ kind: 's', exId: ex.id, idx: n }); }
    }));

    var note = entry && entry.note ? entry.note : '';
    var lastLine = null;
    if (last) {
      lastLine = h('div', { class: 'ex-last', text: 'Zuletzt ' + C.formatDate(last.training.date, 'dm') + ':  ' + C.entrySummary(last.entry) });
    }

    return h('div', { class: 'ex' + (done ? ' is-done' : '') + (ex.hidden ? ' is-hidden' : '') }, [
      h('div', { class: 'ex-head' }, [
        h('span', { class: 'ex-name', text: ex.name }),
        done ? h('span', { class: 'ex-done-mark', 'aria-label': 'erledigt', text: '✓' }) : null,
        h('button', {
          class: 'ex-notebtn' + (note ? ' has-note' : ''),
          'aria-label': 'Notiz', text: 'Notiz',
          onclick: function () { editNote(ex); }
        })
      ]),
      grid,
      note ? h('div', { class: 'ex-note', text: note }) : null,
      lastLine
    ]);
  }

  function editNote(ex) {
    var t = C.getTraining(state, curDate);
    var entry = t ? t.entries[ex.id] : null;
    var ta = h('textarea', { maxlength: '500', placeholder: 'z. B. Sitz Stufe 4, Schulter zwickt …' });
    ta.value = entry ? entry.note : '';
    openDialog([
      h('h2', { text: 'Notiz · ' + ex.name }),
      ta,
      h('div', { class: 'dlg-row dlg-actions' }, [
        h('button', { class: 'btn', text: 'Abbrechen', onclick: closeDialog }),
        h('button', {
          class: 'btn btn-primary', text: 'Speichern', onclick: function () {
            var text = ta.value.trim();
            if (text || entry) {
              var tr = C.ensureTraining(state, curDate);
              C.ensureEntry(tr, ex.id).note = text;
              C.tidyTraining(state, curDate);
              save();
            }
            closeDialog();
            render();
          }
        })
      ])
    ]);
    setTimeout(function () { ta.focus(); }, 50);
  }

  $('trToday').addEventListener('click', function () { curDate = C.todayKey(); render(); });
  $('trPick').addEventListener('click', function () {
    var d = $('trDate');
    if (d.showPicker) { try { d.showPicker(); return; } catch (e) { /* weiter unten */ } }
    d.focus(); d.click();
  });
  $('trDate').addEventListener('change', function () {
    if (C.isValidKey(this.value)) { curDate = this.value; render(); }
  });
  $('bwBtn').addEventListener('click', function () { openPad({ kind: 'bw' }); });
  $('trDelete').addEventListener('click', function () {
    var nr = C.trainingNumber(state, curDate);
    confirmDialog('Training ' + nr + ' löschen?',
      'Alle Einträge vom ' + C.formatDate(curDate, 'long') + ' werden entfernt. Die Nummern der späteren Trainings rücken nach.',
      'Löschen', function () {
        var t = C.getTraining(state, curDate);
        if (t) state.trainings.splice(state.trainings.indexOf(t), 1);
        save();
        toast('Training gelöscht');
        render();
      }, true);
  });

  // ================================================================ ZAHLENFELD

  var pad = null; // { kind, exId, idx, text, fresh, step, unit }

  function padPrefill(o) {
    var t = C.getTraining(state, curDate);
    if (o.kind === 'bw') {
      if (t && t.bodyweight !== null) return { v: t.bodyweight, own: true };
      return { v: C.lastBodyweightBefore(state, curDate), own: false };
    }
    var entry = t ? t.entries[o.exId] : null;
    var last = C.lastEntryBefore(state, o.exId, curDate);
    if (o.kind === 'w') {
      if (entry && entry.weight !== null) return { v: entry.weight, own: true };
      return { v: last ? last.entry.weight : null, own: false };
    }
    var cur = entry ? entry.sets[o.idx] : null;
    if (cur !== null && cur !== undefined) return { v: cur, own: true };
    var lv = last ? last.entry.sets[o.idx] : null;
    if (typeof lv === 'number') return { v: lv, own: false };
    var prev = entry && o.idx > 0 ? entry.sets[o.idx - 1] : null;
    if (typeof prev === 'number') return { v: prev, own: false };
    return { v: null, own: false };
  }

  function openPad(o) {
    var ex = o.exId ? C.findExercise(state, o.exId) : null;
    var pre = padPrefill(o);
    pad = {
      kind: o.kind, exId: o.exId, idx: o.idx,
      text: typeof pre.v === 'number' ? C.fmtNum(pre.v) : '',
      fresh: true,
      check: pre.v === true,
      step: o.kind === 's' ? 1 : o.kind === 'bw' ? 0.1 : 0.5
    };
    var title, sub, unit;
    if (o.kind === 'bw') {
      title = 'Körpergewicht'; unit = 'kg';
      sub = pre.own ? 'heute eingetragen' : pre.v !== null ? 'zuletzt ' + C.fmtNum(pre.v) + ' kg' : 'Schritt 0,1 kg';
    } else if (o.kind === 'w') {
      title = ex.name; unit = 'kg';
      sub = 'Gewicht · ' + (pre.own ? 'eingetragen' : pre.v !== null ? 'zuletzt ' + C.fmtNum(pre.v) + ' kg' : 'Schritt 0,5 kg');
    } else {
      title = ex.name; unit = 'WH';
      var last = C.lastEntryBefore(state, o.exId, curDate);
      var lv = last ? last.entry.sets[o.idx] : null;
      sub = 'Satz ' + (o.idx + 1) + (lv !== null && lv !== undefined ? ' · zuletzt ' + C.setLabel(lv) : '');
    }
    $('padTitle').textContent = title;
    $('padSub').textContent = sub;
    $('padUnit').textContent = unit;
    $('padCheck').hidden = o.kind !== 's';
    document.querySelector('.pad-actions').style.gridTemplateColumns = o.kind === 's' ? '' : '1fr 1.6fr';
    var n = ex ? C.setCount(ex, (C.getTraining(state, curDate) || { entries: {} }).entries[o.exId]) : 0;
    $('padOk').textContent = o.kind === 's' && o.idx + 1 < n ? 'OK · weiter' : o.kind === 'w' ? 'OK · weiter' : 'OK';
    $('pad').hidden = false;
    $('padBackdrop').hidden = false;
    padShow();
  }

  function closePad() {
    pad = null;
    $('pad').hidden = true;
    $('padBackdrop').hidden = true;
  }

  function padShow() {
    var el = $('padVal');
    if (pad.check && pad.fresh) { el.textContent = '✓'; }
    else el.textContent = pad.text || '0';
    el.classList.toggle('is-fresh', pad.fresh && (!!pad.text || pad.check));
    el.classList.toggle('is-empty', !pad.text && !pad.check);
  }

  function padKey(k) {
    if (!pad) return;
    var t = pad.fresh ? '' : pad.text;
    if (pad.fresh) pad.check = false;
    pad.fresh = false;
    if (k === 'del') t = (pad.text && !t ? pad.text : t).slice(0, -1);
    else if (k === ',') { if (pad.kind === 's' && t.indexOf(',') >= 0) return; if (t.indexOf(',') < 0) t = (t || '0') + ','; }
    else {
      var dec = t.indexOf(',');
      if (dec >= 0 && t.length - dec > (pad.kind === 'bw' ? 1 : 2)) return;
      if (dec < 0 && t.replace(/^0/, '').length >= 3) return;
      t = (t === '0' ? '' : t) + k;
    }
    pad.text = t;
    padShow();
  }

  function padStep(dir) {
    if (!pad) return;
    var v = C.parseNum(pad.text);
    if (v === null) v = 0;
    v = C.roundTo(v + dir * pad.step, pad.step);
    if (v < 0) v = 0;
    if (v > 999) v = 999;
    pad.text = C.fmtNum(v);
    pad.fresh = false;
    pad.check = false;
    padShow();
  }

  // value: Zahl, true (✓ ohne Zahl) oder null (leeren)
  function padCommit(value) {
    if (!pad) return;
    var o = pad;
    var today = C.todayKey();
    var nowIso = curDate === today ? new Date().toISOString() : null;
    var t = C.getTraining(state, curDate);
    if (value !== null) t = C.ensureTraining(state, curDate, nowIso);
    var startTimer = false;

    if (t) {
      if (o.kind === 'bw') {
        t.bodyweight = value;
      } else {
        var entry = C.ensureEntry(t, o.exId);
        if (o.kind === 'w') {
          entry.weight = value;
        } else {
          var before = entry.sets[o.idx];
          while (entry.sets.length < o.idx) entry.sets.push(null);
          entry.sets[o.idx] = value;
          // Gewicht beim ersten Satz automatisch vom letzten Mal übernehmen
          var ex = C.findExercise(state, o.exId);
          if (value !== null && entry.weight === null && ex.type === 'weight') {
            var last = C.lastEntryBefore(state, o.exId, curDate);
            if (last && last.entry.weight !== null) entry.weight = last.entry.weight;
          }
          startTimer = value !== null && before !== value && curDate === today;
        }
      }
      C.tidyTraining(state, curDate);
      save();
    }

    closePad();
    render();
    if (startTimer) timerStart();

    // Nach dem Bestätigen direkt zum nächsten Feld springen
    if (value !== null && o.kind !== 'bw') {
      var ex2 = C.findExercise(state, o.exId);
      var t2 = C.getTraining(state, curDate);
      var e2 = t2 ? t2.entries[o.exId] : null;
      var n = C.setCount(ex2, e2);
      if (o.kind === 'w') {
        var firstEmpty = 0;
        while (e2 && firstEmpty < n && e2.sets[firstEmpty] !== null && e2.sets[firstEmpty] !== undefined) firstEmpty++;
        if (firstEmpty < n) openPad({ kind: 's', exId: o.exId, idx: firstEmpty });
      } else if (o.idx + 1 < n) {
        openPad({ kind: 's', exId: o.exId, idx: o.idx + 1 });
      }
    }
  }

  $('padKeys').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) padKey(b.dataset.k);
  });
  $('padMinus').addEventListener('click', function () { padStep(-1); });
  $('padPlus').addEventListener('click', function () { padStep(1); });
  $('padClose').addEventListener('click', closePad);
  $('padBackdrop').addEventListener('click', closePad);
  $('padClear').addEventListener('click', function () { padCommit(null); });
  $('padCheck').addEventListener('click', function () { padCommit(true); });
  $('padOk').addEventListener('click', function () {
    if (!pad) return;
    if (pad.check && pad.fresh) { padCommit(true); return; }
    var v = C.parseNum(pad.text.replace(/,$/, ''));
    if (v === null) { padCommit(null); return; }
    if (pad.kind === 'bw' && (v < 20 || v > 400)) { toast('Bitte ein Körpergewicht zwischen 20 und 400 kg eingeben.', true); return; }
    padCommit(Math.round(v * 100) / 100);
  });
  document.addEventListener('keydown', function (e) {
    if (!pad) return;
    if (/^[0-9]$/.test(e.key)) padKey(e.key);
    else if (e.key === ',' || e.key === '.') padKey(',');
    else if (e.key === 'Backspace') padKey('del');
    else if (e.key === 'Enter') $('padOk').click();
    else if (e.key === 'Escape') closePad();
    else return;
    e.preventDefault();
  });

  // ================================================================ PAUSENTIMER

  var timerEnd = 0, timerInt = null, timerOverAt = 0;

  function timerStart() {
    var sec = state.settings.restSec;
    if (!sec) return;
    timerEnd = Date.now() + sec * 1000;
    timerOverAt = 0;
    $('timer').hidden = false;
    $('timer').classList.remove('is-over');
    document.body.classList.add('has-timer');
    clearInterval(timerInt);
    timerInt = setInterval(timerTick, 250);
    timerTick();
  }

  function timerStop() {
    clearInterval(timerInt);
    timerInt = null;
    $('timer').hidden = true;
    document.body.classList.remove('has-timer');
  }

  function timerTick() {
    var left = Math.ceil((timerEnd - Date.now()) / 1000);
    if (left > 0) {
      $('timerK').textContent = 'Pause';
      $('timerV').textContent = Math.floor(left / 60) + ':' + C.pad2(left % 60);
      return;
    }
    if (!timerOverAt) {
      timerOverAt = Date.now();
      $('timer').classList.add('is-over');
      $('timerK').textContent = 'Pause vorbei';
      $('timerV').textContent = 'Los!';
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    } else if (Date.now() - timerOverAt > 6000) {
      timerStop();
    }
  }

  $('timerMain').addEventListener('click', timerStop);
  $('timerStop').addEventListener('click', timerStop);
  $('timerPlus').addEventListener('click', function () {
    if (timerOverAt) { timerOverAt = 0; timerEnd = Date.now(); $('timer').classList.remove('is-over'); }
    timerEnd += 30000;
    timerTick();
  });

  // ================================================================ ANALYSE

  var ALL = '_all', BW = '_bw';

  function exercisesWithData() {
    var used = {};
    state.trainings.forEach(function (t) { Object.keys(t.entries).forEach(function (k) { used[k] = true; }); });
    return used;
  }

  function renderStats() {
    var used = exercisesWithData();
    var chips = [{ id: ALL, name: 'Alle Trainings' }];
    state.exercises.forEach(function (e) {
      if (!e.hidden || used[e.id]) chips.push({ id: e.id, name: e.name, hidden: e.hidden });
    });
    chips.push({ id: BW, name: 'Körpergewicht' });
    if (!statSel || !chips.some(function (c) { return c.id === statSel; })) statSel = ALL;

    var bar = $('statChips');
    bar.textContent = '';
    chips.forEach(function (c) {
      bar.appendChild(h('button', {
        class: 'chip' + (c.hidden ? ' is-hidden' : ''), role: 'tab',
        'aria-selected': c.id === statSel ? 'true' : 'false', text: c.name,
        onclick: function () { statSel = c.id; renderStats(); }
      }));
    });
    var active = bar.querySelector('[aria-selected="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    var body = $('statBody');
    body.textContent = '';
    if (!state.trainings.length) {
      body.appendChild(h('div', { class: 'empty' }, [
        h('h2', { text: 'Noch keine Trainings' }),
        h('p', { text: 'Sobald du im Bereich Training etwas einträgst, erscheinen hier Verlauf und Diagramme.' })
      ]));
      return;
    }
    if (statSel === ALL) renderAllTrainings(body);
    else renderSeries(body);
  }

  function openTraining(date) {
    curDate = date;
    showView('train');
  }

  function renderAllTrainings(body) {
    var list = state.trainings.slice().reverse();
    body.appendChild(h('div', { class: 'hist-title', text: list.length + (list.length === 1 ? ' Training' : ' Trainings') + ' · zum Bearbeiten antippen' }));
    var order = state.exercises.map(function (e) { return e.id; });
    list.forEach(function (t) {
      var nr = state.trainings.indexOf(t) + 1;
      var keys = Object.keys(t.entries).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      var lines = keys.map(function (k) {
        var ex = C.findExercise(state, k);
        var e = t.entries[k];
        return h('div', { class: 'tline' }, [
          h('span', { class: 'tn', text: (ex ? ex.name : k) + (e.note ? ' ✎' : '') }),
          h('span', { class: 'tv', text: C.entrySummary(e) || '–' })
        ]);
      });
      body.appendChild(h('button', { class: 'tcard', onclick: function () { openTraining(t.date); } }, [
        h('div', { class: 'tcard-head' }, [
          h('span', { class: 'n', text: String(nr) }),
          h('span', { class: 'd', text: C.formatDate(t.date, 'short') }),
          t.bodyweight !== null ? h('span', { class: 'bw', text: C.fmtNum(t.bodyweight) + ' kg' }) : null
        ])
      ].concat(lines)));
    });
  }

  function renderSeries(body) {
    var isBw = statSel === BW;
    var ex = isBw ? null : C.findExercise(state, statSel);
    var from = C.rangeStart(statRange, C.todayKey());
    var data = isBw ? C.bodySeries(state, from) : C.exerciseSeries(state, statSel, from);

    var tabs = h('div', { class: 'tabs' });
    [['3m', '3 Mon.'], ['6m', '6 Mon.'], ['1y', '1 Jahr'], ['all', 'Alles']].forEach(function (r) {
      tabs.appendChild(h('button', {
        'aria-pressed': statRange === r[0] ? 'true' : 'false', text: r[1],
        onclick: function () { statRange = r[0]; renderStats(); }
      }));
    });
    body.appendChild(tabs);

    var card = h('div', { class: 'card' });
    body.appendChild(card);
    card.appendChild(h('h2', { text: isBw ? 'Körpergewicht in kg' : 'Wiederholungen je Satz' }));

    if (!data.rows.length || !data.maxSets) {
      card.appendChild(h('div', { class: 'empty' }, [
        h('p', {
          text: !data.rows.length ? 'Im gewählten Zeitraum gibt es keine Einträge.'
            : 'Hier wurden nur Sätze abgehakt (✓), ohne Wiederholungen – dafür gibt es kein Diagramm.'
        })
      ]));
    } else {
      var series = [];
      for (var i = 0; i < data.maxSets; i++) {
        series.push({ label: isBw ? 'Körpergewicht' : 'Satz ' + (i + 1), short: 'S' + (i + 1), color: 'var(--s' + (i + 1) + ')' });
      }
      var wrap = h('div', { class: 'chart-wrap' });
      var readout = h('div', { class: 'readout', 'aria-live': 'polite' });
      card.appendChild(wrap);
      if (series.length > 1) {
        card.appendChild(h('div', { class: 'legend' }, series.map(function (sr) {
          return h('span', {}, [h('i', { class: 'lkey', style: 'background:' + sr.color }), sr.label]);
        })));
      }
      card.appendChild(readout);
      lineChart(wrap, {
        rows: data.rows, series: series, weights: !isBw,
        decimals: isBw,
        onSelect: function (row) { showReadout(readout, row, series, isBw); }
      });
    }

    // Tabelle unter dem Diagramm (zugleich Verlauf)
    var rows = data.rows.slice().reverse();
    if (rows.length) {
      body.appendChild(h('div', { class: 'hist-title', text: 'Verlauf · zum Bearbeiten antippen' }));
      rows.forEach(function (r) {
        var t = C.getTraining(state, r.date);
        var entry = !isBw && t ? t.entries[statSel] : null;
        var main = isBw ? C.fmtNum(r.ys[0]) + ' kg' : (entry.sets.filter(function (v) { return v !== null; }).map(C.setLabel).join(' · ') || '–');
        var meta = isBw ? C.formatDate(r.date, 'short')
          : [C.formatDate(r.date, 'short'), entry.weight !== null ? C.fmtNum(entry.weight) + ' kg' : (ex && ex.type === 'body' ? 'ohne Gewicht' : ''), entry.note].filter(Boolean).join(' · ');
        body.appendChild(h('button', { class: 'hist-item', onclick: function () { openTraining(r.date); } }, [
          h('div', { class: 'hist-nr' }, [h('div', { class: 'n', text: String(r.nr) }), h('div', { class: 'd', text: 'Nr.' })]),
          h('div', { class: 'hist-main' }, [h('div', { class: 'v', text: main }), h('div', { class: 'm', text: meta })]),
          h('span', { class: 'hist-go', 'aria-hidden': 'true', text: '›' })
        ]));
      });
    }
  }

  function showReadout(el, row, series, isBw) {
    el.textContent = '';
    var head = h('div', { class: 'r-head' }, [
      h('strong', { text: 'Nr. ' + row.nr }), '  ·  ' + C.formatDate(row.date, 'short')
    ]);
    if (!isBw) head.appendChild(document.createTextNode('  ·  ' + (row.weight !== null ? C.fmtNum(row.weight) + ' kg' : 'ohne Gewicht')));
    el.appendChild(head);
    var vals = h('div', { class: 'r-vals' });
    series.forEach(function (sr, i) {
      var v = isBw ? row.ys[0] : row.sets[i];
      if (v === null || v === undefined) return;
      vals.appendChild(h('span', {}, [
        series.length > 1 ? h('i', { class: 'lkey', style: 'background:' + sr.color }) : null,
        h('b', { text: isBw ? C.fmtNum(v) + ' kg' : C.setLabel(v) }),
        series.length > 1 ? sr.short : null
      ]));
    });
    el.appendChild(vals);
  }

  function niceStep(range, target) {
    var raw = range / target;
    var steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return 100;
  }

  // Liniendiagramm: x = Datum, y = Wiederholungen (eine Achse).
  // Das Gewicht steht dezent als Beschriftung unter der Zeitachse,
  // immer dort, wo es sich geändert hat.
  function lineChart(wrap, cfg) {
    var W = Math.max(280, Math.round(wrap.clientWidth || 340));
    var H = cfg.weights ? 236 : 210;
    var padL = 34, padR = 30, padT = 14;
    var plotB = H - (cfg.weights ? 58 : 30);
    var rows = cfg.rows;

    var vals = [];
    rows.forEach(function (r) { r.ys.forEach(function (v) { if (v !== null) vals.push(v); }); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var step = niceStep(Math.max(hi - lo, cfg.decimals ? 2 : 4), 4);
    if (!cfg.decimals) step = Math.max(1, Math.round(step));
    lo = Math.floor(lo / step) * step - (cfg.decimals ? step : 0);
    hi = Math.ceil(hi / step) * step + (cfg.decimals ? step : 0);
    if (!cfg.decimals) { lo = Math.max(0, lo - step); hi = hi + step; }
    if (hi === lo) hi = lo + step;

    var t0 = C.parseKey(rows[0].date).getTime(), t1 = C.parseKey(rows[rows.length - 1].date).getTime();
    function X(r) {
      if (t1 === t0) return (padL + W - padR) / 2;
      return padL + (C.parseKey(r.date).getTime() - t0) / (t1 - t0) * (W - padL - padR);
    }
    function Y(v) { return plotB - (v - lo) / (hi - lo) * (plotB - padT); }

    var svg = s('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Verlauf' });

    // Raster und y-Achse
    for (var g = 0; lo + g * step <= hi + 1e-9; g++) {
      var v = lo + g * step;
      var y = Y(v);
      svg.appendChild(s('line', { class: 'c-grid', x1: padL, x2: W - padR + 6, y1: y, y2: y }));
      svg.appendChild(s('text', { class: 'c-axis', x: padL - 6, y: y + 4, 'text-anchor': 'end' }, C.fmtNum(Math.round(v * 10) / 10)));
    }

    // x-Achse: erstes, mittleres und letztes Datum
    var xIdx = rows.length > 2 ? [0, Math.floor((rows.length - 1) / 2), rows.length - 1] : rows.map(function (_, i) { return i; });
    var lastRight = -1e9;
    xIdx.forEach(function (i, k) {
      var x = X(rows[i]);
      var anchor = rows.length === 1 ? 'middle' : k === 0 ? 'start' : k === xIdx.length - 1 ? 'end' : 'middle';
      var tx = anchor === 'start' ? x - 4 : anchor === 'end' ? x + 4 : x;
      var left = anchor === 'start' ? tx : anchor === 'end' ? tx - 40 : tx - 20;
      if (left < lastRight + 6) return;
      lastRight = left + 40;
      svg.appendChild(s('text', { class: 'c-axis', x: tx, y: H - 6, 'text-anchor': anchor }, C.formatDate(rows[i].date, 'dm')));
    });

    // Gewicht dezent: gestrichelte Stufe + Beschriftung bei jeder Änderung
    if (cfg.weights) {
      var wy = plotB + 20;
      var prevW, lastLabelX = -1e9;
      rows.forEach(function (r) {
        if (r.weight === prevW) return;
        prevW = r.weight;
        var x = X(r);
        svg.appendChild(s('line', { class: 'c-wtick', x1: x, x2: x, y1: plotB + 4, y2: plotB + 9 }));
        if (x - lastLabelX < 36) return;
        lastLabelX = x;
        var label = r.weight !== null ? C.fmtNum(r.weight) + ' kg' : 'ohne';
        var anchor = x < padL + 18 ? 'start' : x > W - padR - 18 ? 'end' : 'middle';
        svg.appendChild(s('text', { class: 'c-wt', x: anchor === 'start' ? x - 3 : anchor === 'end' ? x + 3 : x, y: wy, 'text-anchor': anchor }, label));
      });
    }

    // Linien und Punkte
    var ends = [];
    cfg.series.forEach(function (sr, i) {
      var pts = rows.filter(function (r) { return r.ys[i] !== null && r.ys[i] !== undefined; });
      if (!pts.length) return;
      if (pts.length > 1) {
        var d = pts.map(function (r, k) { return (k ? 'L' : 'M') + X(r).toFixed(1) + ' ' + Y(r.ys[i]).toFixed(1); }).join(' ');
        svg.appendChild(s('path', { class: 'c-line', d: d, style: 'stroke:' + sr.color }));
      }
      pts.forEach(function (r) {
        svg.appendChild(s('circle', { class: 'c-dot', cx: X(r), cy: Y(r.ys[i]), r: pts.length > 40 ? 2.5 : 4, style: 'fill:' + sr.color }));
      });
      var lp = pts[pts.length - 1];
      ends.push({ y: Y(lp.ys[i]), x: X(lp), label: sr.short, color: sr.color });
    });

    // Direkte Beschriftung am Linienende (S1, S2 …), Überlappungen auseinanderschieben
    if (cfg.series.length > 1 && cfg.series.length <= 4) {
      ends.sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
      ends.forEach(function (e) {
        svg.appendChild(s('text', { class: 'c-end', x: W - padR + 8, y: e.y + 4 }, e.label));
      });
    }

    // Auswahl per Antippen: Haarlinie + Werte darunter
    var hair = s('line', { class: 'c-hair', y1: padT - 4, y2: plotB, x1: 0, x2: 0 });
    var marks = s('g', {});
    svg.appendChild(hair);
    svg.appendChild(marks);
    var hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    svg.appendChild(hit);

    function select(i) {
      var r = rows[i];
      var x = X(r);
      hair.setAttribute('x1', x); hair.setAttribute('x2', x);
      marks.textContent = '';
      cfg.series.forEach(function (sr, k) {
        if (r.ys[k] === null || r.ys[k] === undefined) return;
        marks.appendChild(s('circle', { class: 'c-dot', cx: x, cy: Y(r.ys[k]), r: 6, style: 'fill:' + sr.color }));
      });
      cfg.onSelect(r);
    }
    function nearest(evt) {
      var rect = svg.getBoundingClientRect();
      var px = (evt.clientX - rect.left) / rect.width * W;
      var best = 0, bd = Infinity;
      rows.forEach(function (r, i) { var d = Math.abs(X(r) - px); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    svg.addEventListener('pointerdown', function (e) { select(nearest(e)); });
    svg.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'mouse') select(nearest(e)); });

    wrap.appendChild(svg);
    select(rows.length - 1);
  }

  // ================================================================ EINSTELLUNGEN

  function backupDue() {
    if (!state.trainings.length) return false;
    var lb = state.settings.lastBackup;
    if (!lb) return state.trainings.length >= 3;
    return (Date.now() - new Date(lb).getTime()) / 864e5 > 30;
  }

  function renderMore() {
    // Übungen
    var box = $('exManage');
    box.textContent = '';
    var used = exercisesWithData();
    state.exercises.forEach(function (ex, i) {
      var meta = (ex.type === 'body' ? 'Körpergewicht' : 'mit Gewicht') + ' · ' + ex.sets + (ex.sets === 1 ? ' Satz' : ' Sätze') + (ex.hidden ? ' · ausgeblendet' : '');
      box.appendChild(h('div', { class: 'mrow' + (ex.hidden ? ' is-hidden' : '') }, [
        h('button', { class: 'mrow-main', onclick: function () { editExercise(ex, !!used[ex.id]); } }, [
          h('span', { class: 'mrow-name', text: ex.name }),
          h('span', { class: 'mrow-meta', text: meta })
        ]),
        h('button', { class: 'mbtn', 'aria-label': ex.name + ' nach oben', text: '↑', disabled: i === 0 ? true : null, onclick: function () { moveExercise(i, -1); } }),
        h('button', { class: 'mbtn', 'aria-label': ex.name + ' nach unten', text: '↓', disabled: i === state.exercises.length - 1 ? true : null, onclick: function () { moveExercise(i, 1); } })
      ]));
    });

    document.querySelectorAll('#restSeg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.v === state.settings.restSec));
    });
    document.querySelectorAll('#themeSeg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === state.settings.theme));
    });

    var lb = state.settings.lastBackup;
    var info = state.trainings.length + (state.trainings.length === 1 ? ' Training' : ' Trainings') + ' gespeichert. ';
    if (lb) {
      var days = Math.floor((Date.now() - new Date(lb).getTime()) / 864e5);
      info += 'Letztes Backup: ' + (days === 0 ? 'heute' : days === 1 ? 'gestern' : 'vor ' + days + ' Tagen') + '.';
    } else info += 'Noch kein Backup gespeichert.';
    if (backupDue()) info += lb ? ' Zeit für ein neues Backup!' : ' Am besten gleich eins anlegen.';
    $('backupInfo').textContent = info;

    var undo = null;
    try { undo = localStorage.getItem(KEY_UNDO); } catch (e) { /* egal */ }
    $('undoImport').hidden = !undo;
    $('appVersion').textContent = APP_VERSION;

    var si = $('storageInfo');
    if (storageBroken) si.textContent = 'Achtung: Gespeicherte Daten konnten nicht gelesen werden.';
    else if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        si.textContent = p ? 'Dauerhafter Speicher ist aktiv – Android löscht die Daten nicht von selbst.'
          : 'Die Daten liegen im Browser-Speicher dieses Geräts. Regelmäßige Backups schützen vor Verlust.';
      }).catch(function () {});
    }
  }

  function moveExercise(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.exercises.length) return;
    var tmp = state.exercises[i];
    state.exercises[i] = state.exercises[j];
    state.exercises[j] = tmp;
    save();
    renderMore();
  }

  function editExercise(ex, hasData) {
    var isNew = !ex;
    var draft = ex ? { name: ex.name, type: ex.type, sets: ex.sets, hidden: ex.hidden } : { name: '', type: 'weight', sets: 3, hidden: false };

    var name = h('input', { type: 'text', maxlength: '40', placeholder: 'z. B. Beinpresse', autocomplete: 'off' });
    name.value = draft.name;

    var typeSeg = h('div', { class: 'segmented' });
    [['weight', 'Mit Gewicht'], ['body', 'Körpergewicht']].forEach(function (o) {
      typeSeg.appendChild(h('button', {
        'aria-pressed': String(draft.type === o[0]), text: o[1],
        onclick: function () {
          draft.type = o[0];
          typeSeg.querySelectorAll('button').forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === (o[0] === 'weight' ? 0 : 1))); });
        }
      }));
    });

    var out = h('output', { text: String(draft.sets) });
    var stepper = h('div', { class: 'stepper' }, [
      h('button', { text: '−', 'aria-label': 'weniger Sätze', onclick: function () { draft.sets = Math.max(1, draft.sets - 1); out.textContent = draft.sets; } }),
      out,
      h('button', { text: '+', 'aria-label': 'mehr Sätze', onclick: function () { draft.sets = Math.min(C.MAX_SETS, draft.sets + 1); out.textContent = draft.sets; } })
    ]);

    function doSave() {
      var n = name.value.trim().slice(0, 40);
      if (!n) { toast('Bitte einen Namen eingeben.', true); name.focus(); return; }
      if (isNew) {
        state.exercises.push({ id: C.makeExerciseId(n, state), name: n, type: draft.type, sets: draft.sets, hidden: false });
      } else {
        ex.name = n; ex.type = draft.type; ex.sets = draft.sets;
      }
      save();
      closeDialog();
      render();
      toast(isNew ? 'Übung hinzugefügt' : 'Gespeichert');
    }

    var nodes = [
      h('h2', { text: isNew ? 'Neue Übung' : 'Übung bearbeiten' }),
      h('label', { class: 'fl', text: 'Name' }), name,
      h('label', { class: 'fl', text: 'Art' }), typeSeg,
      h('label', { class: 'fl', text: 'Sätze (Standard)' }), stepper,
      h('div', { class: 'dlg-row dlg-actions' }, [
        h('button', { class: 'btn', text: 'Abbrechen', onclick: closeDialog }),
        h('button', { class: 'btn btn-primary', text: 'Speichern', onclick: doSave })
      ])
    ];

    if (!isNew) {
      nodes.push(h('div', { class: 'dlg-sep' }));
      nodes.push(h('button', {
        class: 'btn', text: ex.hidden ? 'Wieder einblenden' : 'Ausblenden (Verlauf bleibt)',
        onclick: function () {
          ex.hidden = !ex.hidden;
          save(); closeDialog(); render();
          toast(ex.hidden ? 'Ausgeblendet – der Verlauf bleibt erhalten' : 'Wieder eingeblendet');
        }
      }));
      nodes.push(h('button', {
        class: 'btn btn-danger', text: 'Endgültig löschen',
        onclick: function () {
          confirmDialog(ex.name + ' löschen?',
            hasData ? 'Die Übung und ihr gesamter Verlauf werden gelöscht. Das lässt sich nicht rückgängig machen. Wenn du den Verlauf behalten willst, wähle stattdessen „Ausblenden“.'
              : 'Die Übung wird aus der Liste entfernt.',
            'Löschen', function () { deleteExercise(ex); }, true);
        }
      }));
    }
    openDialog(nodes);
    if (isNew) setTimeout(function () { name.focus(); }, 50);
  }

  function deleteExercise(ex) {
    state.exercises.splice(state.exercises.indexOf(ex), 1);
    state.trainings.slice().forEach(function (t) {
      delete t.entries[ex.id];
      C.tidyTraining(state, t.date);
    });
    if (statSel === ex.id) statSel = null;
    save();
    render();
    toast('Übung gelöscht');
  }

  $('exAdd').addEventListener('click', function () { editExercise(null, false); });

  $('restSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.settings.restSec = +b.dataset.v;
    save();
    renderMore();
  });

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.settings.theme === 'light' ? '#edf2f2' : '#10181b');
  }
  $('themeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    state.settings.theme = b.dataset.v;
    applyTheme();
    save();
    renderMore();
  });

  $('doBackup').addEventListener('click', function () {
    state.settings.lastBackup = new Date().toISOString();
    save();
    download('fitness-backup-' + C.todayKey() + '.json', JSON.stringify(C.buildExport(state), null, 1), 'application/json');
    toast('Backup gespeichert (Ordner „Downloads“)');
    render();
  });

  $('doCsv').addEventListener('click', function () {
    if (!state.trainings.length) { toast('Noch keine Trainings zum Exportieren.'); return; }
    download('fitness-' + C.todayKey() + '.csv', C.toCsv(state), 'text/csv;charset=utf-8');
    toast('CSV gespeichert (Ordner „Downloads“)');
  });

  $('doImport').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try { next = C.parseImport(String(reader.result)); }
      catch (e) { toast(e.message, true); return; }
      confirmDialog('Backup einspielen?',
        'Die Sicherung enthält ' + next.trainings.length + ' Trainings und ' + next.exercises.length + ' Übungen. ' +
        'Sie ersetzt die aktuellen Daten (' + state.trainings.length + ' Trainings). Der jetzige Stand lässt sich danach einmal wiederherstellen.',
        'Einspielen', function () {
          try { localStorage.setItem(KEY_UNDO, JSON.stringify(state)); } catch (e) { /* ohne Rückgängig weiter */ }
          state = next;
          applyTheme();
          save();
          curDate = C.todayKey();
          render();
          toast('Backup eingespielt');
        });
    };
    reader.readAsText(f);
  });

  $('undoImport').addEventListener('click', function () {
    confirmDialog('Import rückgängig machen?', 'Der Stand vor dem letzten Import wird wiederhergestellt.', 'Wiederherstellen', function () {
      try {
        var raw = localStorage.getItem(KEY_UNDO);
        if (!raw) return;
        state = C.sanitizeState(JSON.parse(raw));
        localStorage.removeItem(KEY_UNDO);
      } catch (e) { toast('Wiederherstellen fehlgeschlagen.', true); return; }
      applyTheme();
      save();
      render();
      toast('Vorheriger Stand wiederhergestellt');
    });
  });

  // ================================================================ START

  load();
  applyTheme();
  render();

  // Tageswechsel: Wenn die App über Mitternacht offen bleibt oder aus dem
  // Hintergrund zurückkommt, springt sie auf das heutige Training.
  var lastToday = C.todayKey();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var now = C.todayKey();
    if (now !== lastToday) {
      if (curDate === lastToday) curDate = now;
      lastToday = now;
      render();
    }
    if (timerInt) timerTick();
  });

  // Beim Drehen/Ändern der Breite Diagramm neu zeichnen
  var rsz;
  window.addEventListener('resize', function () {
    clearTimeout(rsz);
    rsz = setTimeout(function () { if (currentView === 'stats') renderStats(); }, 200);
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
