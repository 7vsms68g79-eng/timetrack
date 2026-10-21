/* TimeTrack – Oberfläche */
(function () {
  'use strict';

  const T = window.TT;
  const STORE = 'timetrack:v1';
  const UI_STORE = 'timetrack:ui';

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => (Math.abs(n) === 1 ? one : many);
  const ddmm = (d) => `${T.pad(d.getDate())}.${T.pad(d.getMonth() + 1)}.`;
  const longDate = (d) => `${d.getDate()}. ${T.MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const $top = $('#top');
  const $main = $('#main');
  const $tabbar = $('#tabbar');
  const $sheetRoot = $('#sheet-root');
  const $toast = $('#toast');

  /* ---------- Icons ---------- */

  const svg = (d, cls = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${d}</svg>`;
  const ICON = {
    glass:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11M6.5 21h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M8 3.5c0 4 4 5.3 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5.3-4 8.5s4 4.5 4 8.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M9.4 7.4h5.2c-.7 1.3-1.7 2.1-2.6 2.9-.9-.8-1.9-1.6-2.6-2.9zM12 15.4c1.3 0 2.7 1.5 3.4 4.1H8.6c.7-2.6 2.1-4.1 3.4-4.1z" fill="currentColor"/></svg>',
    cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r=".6" fill="currentColor"/><circle cx="12" cy="14.5" r=".6" fill="currentColor"/><circle cx="15.5" cy="14.5" r=".6" fill="currentColor"/>'),
    clock: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.4 2M9.5 2.8h5M12 2.8V6"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
    chevL: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    chevR: svg('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
    share: svg('<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 11H6v9h12v-9h-1"/>'),
    download: svg('<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 20h14"/>'),
    flag: svg('<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>'),
  };

  /* ---------- Zustand & Speicher ---------- */

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  function today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  const todayKey = () => T.keyOf(today());

  const uiPrefs = readJSON(UI_STORE) || {};
  const state = {
    data: T.normalize(readJSON(STORE)),
    tab: ['calendar', 'overtime', 'vacation', 'settings'].includes(uiPrefs.tab) ? uiPrefs.tab : 'calendar',
    view: ['day', 'week', 'month'].includes(uiPrefs.view) ? uiPrefs.view : 'month',
    cursor: today(),
    sheet: null,
    undo: null,
  };

  function persist() {
    if (!writeJSON(STORE, state.data)) toast('Speichern nicht möglich – Speicher blockiert?');
  }
  function persistUI() {
    writeJSON(UI_STORE, { tab: state.tab, view: state.view, hideInstall: !!uiPrefs.hideInstall });
  }

  const startYear = () => T.parseKey(state.data.settings.startDate).getFullYear();
  const minYear = () => Math.min(startYear(), today().getFullYear());
  const maxYear = () => Math.max(startYear(), today().getFullYear()) + 10;
  const year = () => state.cursor.getFullYear();

  function clampCursor() {
    const y = year();
    if (y < minYear()) state.cursor = new Date(minYear(), 0, 1);
    if (y > maxYear()) state.cursor = new Date(maxYear(), 11, 31);
  }

  /* ---------- Rendering ---------- */

  function render() {
    renderTop();
    renderMain();
    renderTabbar();
  }
  function refresh() {
    render();
    if (state.sheet) renderSheet();
  }

  function overtimeStatus(y) {
    const ys = T.yearSummary(state.data, y);
    const ty = today().getFullYear();
    const label = y === ty ? 'aktueller Saldo' : y < ty ? `Stand 31.12.${y}` : `Prognose 31.12.${y}`;
    return { ys, value: ys.end, label };
  }

  function renderTop() {
    const y = year();
    const yearCtl = state.tab === 'settings' ? '' : `
      <div class="yearpick" role="group" aria-label="Jahr wählen">
        <button data-act="year" data-d="-1" aria-label="Vorheriges Jahr" ${y <= minYear() ? 'disabled' : ''}>${ICON.chevL}</button>
        <span>${y}</span>
        <button data-act="year" data-d="1" aria-label="Nächstes Jahr" ${y >= maxYear() ? 'disabled' : ''}>${ICON.chevR}</button>
      </div>`;
    let hero;
    if (state.tab === 'calendar') hero = calendarHero(y);
    else if (state.tab === 'overtime') hero = overtimeHero(y);
    else if (state.tab === 'vacation') hero = vacationHero(y);
    else hero = '<div class="hero"><h1 class="hero-title">Einstellungen</h1></div>';
    $top.innerHTML = `<div class="wrap">
      <div class="brand-row"><div class="brand">${ICON.glass}<span>TimeTrack</span></div>${yearCtl}</div>
      ${hero}
    </div>`;
  }

  function calendarHero(y) {
    const ot = overtimeStatus(y);
    const vs = T.vacationSummary(state.data, y, todayKey());
    return `<div class="stats">
      <button class="stat ot" data-act="tab" data-tab="overtime">
        <span class="stat-label">Überstunden</span>
        <span class="stat-value${ot.value < 0 ? ' neg' : ''}">${T.fmt(ot.value, true)}<small>h</small></span>
        <span class="stat-sub">${ot.label}</span>
      </button>
      <button class="stat vac" data-act="tab" data-tab="vacation">
        <span class="stat-label">Urlaub ${y}</span>
        <span class="stat-value${vs.remaining < 0 ? ' neg' : ''}">${T.num(vs.remaining)}<small>${plural(vs.remaining, 'Tag', 'Tage')}</small></span>
        <span class="stat-sub">übrig von ${T.num(vs.total)}</span>
      </button>
    </div>`;
  }

  function overtimeHero(y) {
    const ot = overtimeStatus(y);
    let sub = ot.label;
    if (y === today().getFullYear()) {
      const now = T.balance(state.data, { until: todayKey() });
      if (now !== ot.value) sub = `heute ${T.fmt(now, true)} h · inkl. Geplantem ${T.fmt(ot.value, true)} h`;
    }
    return `<div class="hero">
      <span class="hero-label">Überstunden-Saldo</span>
      <span class="hero-value${ot.value < 0 ? ' neg' : ''}">${T.fmt(ot.value, true)}<small>h</small></span>
      <span class="hero-sub">${sub}</span>
    </div>`;
  }

  function vacationHero(y) {
    const vs = T.vacationSummary(state.data, y, todayKey());
    return `<div class="hero">
      <span class="hero-label">Resturlaub ${y}</span>
      <span class="hero-value vac${vs.remaining < 0 ? ' neg' : ''}">${T.num(vs.remaining)}<small>${plural(vs.remaining, 'Tag', 'Tage')}</small></span>
      <span class="hero-sub">von ${T.num(vs.total)} Tagen · ${vs.taken} genommen · ${vs.planned} geplant</span>
    </div>`;
  }

  function renderMain() {
    let html;
    if (state.tab === 'calendar') html = calendarTab();
    else if (state.tab === 'overtime') html = overtimeTab();
    else if (state.tab === 'vacation') html = vacationTab();
    else html = settingsTab();
    $main.innerHTML = `<div class="wrap">${html}</div>`;
  }

  const TABS = [
    ['calendar', 'Kalender', 'cal'],
    ['overtime', 'Überstunden', 'clock'],
    ['vacation', 'Urlaub', 'sun'],
    ['settings', 'Einstellungen', 'sliders'],
  ];
  function renderTabbar() {
    $tabbar.innerHTML = `<div class="tabs">${TABS.map(([id, label, icon]) => `
      <button class="tab${state.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}"${state.tab === id ? ' aria-current="page"' : ''}>
        ${ICON[icon]}<span>${label}</span>
      </button>`).join('')}</div>`;
  }

  /* ---------- Kalender ---------- */

  function rangeLabel(a, b) {
    if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${T.MONTHS_SHORT[b.getMonth()]}`;
    return `${a.getDate()}. ${T.MONTHS_SHORT[a.getMonth()]} – ${b.getDate()}. ${T.MONTHS_SHORT[b.getMonth()]}`;
  }

  function calendarTab() {
    const v = state.view;
    const c = state.cursor;
    const seg = `<div class="seg" role="tablist" aria-label="Ansicht">${[['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat']]
      .map(([id, l]) => `<button role="tab" aria-selected="${v === id}" class="${v === id ? 'on' : ''}" data-act="view" data-view="${id}">${l}</button>`)
      .join('')}</div>`;
    let title;
    if (v === 'month') title = `${T.MONTHS[c.getMonth()]}<small>${c.getFullYear()}</small>`;
    else if (v === 'week') {
      const ws = T.startOfWeek(c);
      title = `KW ${T.isoWeek(c)}<small>${rangeLabel(ws, T.addDays(ws, 6))}</small>`;
    } else title = `${T.WD_SHORT[c.getDay()]}, ${c.getDate()}. ${T.MONTHS_SHORT[c.getMonth()]}<small>${c.getFullYear()}</small>`;
    const unit = v === 'month' ? 'Monat' : v === 'week' ? 'Woche' : 'Tag';
    const nav = `<div class="calnav">
      <h2>${title}</h2>
      <button class="iconbtn" data-act="nav" data-d="-1" aria-label="${unit} zurück">${ICON.chevL}</button>
      <button class="todaybtn" data-act="today">Heute</button>
      <button class="iconbtn" data-act="nav" data-d="1" aria-label="${unit} vor">${ICON.chevR}</button>
    </div>`;
    const body = v === 'month' ? monthView() : v === 'week' ? weekView() : dayView();
    return `${installBanner()}<section class="cal">${seg}${nav}<div class="cal-body" data-swipe>${body}</div></section>`;
  }

  function monthView() {
    const c = state.cursor;
    const y = c.getFullYear(), m = c.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m, T.daysInMonth(y, m));
    const end = T.addDays(T.startOfWeek(last), 6);
    const tk = todayKey();
    const sched = state.data.settings.schedule;
    let cells = '';
    for (let d = T.startOfWeek(first); d <= end; d = T.addDays(d, 1)) {
      const k = T.keyOf(d);
      cells += cellHTML(T.dayInfo(state.data, k), d.getMonth() !== m, k === tk);
    }
    const head = [1, 2, 3, 4, 5, 6, 0].map((wd) => `<span class="${sched[wd] ? 'work' : ''}">${T.WD_SHORT[wd]}</span>`).join('');
    const sum = T.rangeSummary(state.data, T.keyOf(first), T.keyOf(last));
    return `<div class="wd-head">${head}</div><div class="grid">${cells}</div>${summaryHTML(sum)}${legendHTML()}`;
  }

  function cellHTML(i, out, isToday) {
    const cls = ['cell'];
    if (out) cls.push('out');
    if (i.beforeStart) cls.push('pre');
    if (i.vacation) cls.push('is-vac');
    else if (i.overtime) cls.push('is-ot');
    else if (i.target > 0) cls.push('work');
    else if (i.holiday && i.scheduled > 0) cls.push('hol');
    if (isToday) cls.push('today');

    let mid = '';
    let label = `${T.WD_LONG[i.weekday]}, ${longDate(i.date)}`;
    if (i.vacation) { mid = '<span class="c-lbl">Urlaub</span>'; label += ', Urlaub'; }
    else if (i.overtime) { mid = '<span class="c-lbl">ÜS</span>'; label += ', Überstunden angerechnet'; }
    else if (i.hasWork) { mid = `<span class="c-ist${i.gained > 0 ? ' plus' : ''}">${T.fmt(i.worked)}</span>`; label += `, ${T.fmt(i.worked)} Stunden gearbeitet`; }
    else if (i.holiday) { mid = '<span class="c-hol">Feiertag</span>'; label += `, ${i.holiday}`; }
    if (i.target > 0) label += `, Soll ${T.fmt(i.target)} Stunden`;

    const soll = i.target > 0 ? `<span class="c-soll">${T.fmtShort(i.target)}</span>` : '';
    let bar = '';
    if (i.target > 0 && i.hasWork && !i.vacation && !i.overtime) {
      const p = Math.min(1, i.worked / i.target);
      bar = `<span class="c-bar${p >= 1 ? ' full' : ''}"><i style="width:${Math.round(p * 100)}%"></i></span>`;
    }
    return `<button class="${cls.join(' ')}" data-act="open" data-key="${i.key}" aria-label="${esc(label)}">
      <span class="c-top"><span class="c-num">${i.date.getDate()}</span>${soll}</span>
      <span class="c-mid">${mid}</span>${bar}
    </button>`;
  }

  function summaryHTML(sum) {
    const cls = sum.delta > 0 ? 'pos' : sum.delta < 0 ? 'neg' : '';
    return `<div class="sumrow">
      <div><span class="lbl">Soll</span><b>${T.fmt(sum.target)}</b></div>
      <div><span class="lbl">Gearbeitet</span><b>${T.fmt(sum.worked)}</b></div>
      <div><span class="lbl">Überstunden</span><b class="${cls}">${T.fmt(sum.delta, true)}</b></div>
    </div>`;
  }

  const legendHTML = () => `<div class="legend">
    <span><i class="lg-work"></i>Arbeitstag · Soll in Std.</span>
    <span><i class="lg-vac"></i>Urlaub</span>
    <span><i class="lg-ot"></i>ÜS = Überstunden genommen</span>
    <span><i class="lg-hol"></i>Feiertag</span>
  </div>`;

  function workText(w, worked) {
    if (!w) return '';
    if (w.mode === 'duration') return `${T.fmt(worked)} h gearbeitet`;
    return `${w.start}–${w.end}${w.pause ? ` · ${w.pause} min Pause` : ''} · ${T.fmt(worked)} h`;
  }

  function weekView() {
    const ws = T.startOfWeek(state.cursor);
    const tk = todayKey();
    let rows = '';
    for (let n = 0; n < 7; n++) {
      const k = T.keyOf(T.addDays(ws, n));
      rows += weekRow(T.dayInfo(state.data, k), k === tk);
    }
    const sum = T.rangeSummary(state.data, T.keyOf(ws), T.keyOf(T.addDays(ws, 6)));
    return `${summaryHTML(sum)}<div class="week">${rows}</div>`;
  }

  function weekRow(i, isToday) {
    const cls = ['wrow'];
    let title, sub = '', delta = '', bar = '';
    if (i.beforeStart) {
      cls.push('pre', 'free');
      title = 'Vor Arbeitsbeginn';
    } else if (i.vacation) {
      cls.push('is-vac');
      title = 'Urlaub';
      sub = i.credit ? `Soll ${T.fmt(i.target)} h als Überstunden gutgeschrieben` : 'Ganzer Tag';
      delta = i.credit ? T.fmt(i.credit, true) : '';
    } else if (i.overtime) {
      cls.push('is-ot');
      title = 'Überstunden genommen';
      sub = i.hasWork ? `${workText(i.entry.work, i.worked)} · Rest aus dem Saldo` : `Ganzer Tag · Soll ${T.fmt(i.target)} h`;
      delta = T.fmt(-i.used);
    } else if (i.target > 0) {
      cls.push('work');
      title = `Soll ${T.fmt(i.target)} h`;
      const p = Math.min(1, i.worked / i.target);
      bar = `<div class="wr-bar${p >= 1 ? ' full' : ''}"><i style="width:${Math.round(p * 100)}%"></i></div>`;
      if (i.hasWork) {
        sub = workText(i.entry.work, i.worked);
        if (i.worked < i.target) sub += ` · ${T.fmt(i.target - i.worked)} h unter Soll, kein Abzug`;
      } else sub = i.pause ? `Anwesenheit ${T.fmt(i.presence)} h inkl. ${i.pause} min Pause` : 'Noch nichts eingetragen';
      if (i.gained) delta = `<span class="pos">${T.fmt(i.gained, true)}</span>`;
    } else {
      cls.push('free');
      title = i.holiday || 'Frei';
      if (i.holiday && i.scheduled) sub = 'Feiertag – kein Soll';
      if (i.hasWork) {
        sub = workText(i.entry.work, i.worked);
        delta = `<span class="pos">${T.fmt(i.gained, true)}</span>`;
      }
    }
    if (isToday) cls.push('today');
    return `<button class="${cls.join(' ')}" data-act="open" data-key="${i.key}">
      <span class="wr-date"><span class="wr-wd">${T.WD_SHORT[i.weekday]}</span><span class="wr-num">${i.date.getDate()}</span></span>
      <span class="wr-main">
        <span class="wr-line"><span class="wr-title">${esc(title)}</span><span class="wr-delta">${delta}</span></span>
        ${bar}${sub ? `<span class="wr-sub">${sub}</span>` : ''}
      </span>
    </button>`;
  }

  function dayView() {
    const c = state.cursor;
    const k = T.keyOf(c);
    const ws = T.startOfWeek(c);
    const tk = todayKey();
    let strip = '';
    for (let n = 0; n < 7; n++) {
      const d = T.addDays(ws, n);
      const dk = T.keyOf(d);
      const i = T.dayInfo(state.data, dk);
      const dot = i.vacation ? 'vac' : i.overtime ? 'ot' : i.hasWork ? (i.gained > 0 ? 'plus' : 'work') : '';
      const cls = [dk === k ? 'on' : '', i.target > 0 ? 'work' : '', dk === tk ? 'today' : ''].filter(Boolean).join(' ');
      strip += `<button class="${cls}" data-act="pick" data-key="${dk}" aria-label="${T.WD_LONG[d.getDay()]}, ${longDate(d)}">
        <span class="s-wd">${T.WD_SHORT[d.getDay()]}</span><span class="s-num">${d.getDate()}</span><span class="s-dot ${dot}"></span>
      </button>`;
    }
    const i = T.dayInfo(state.data, k);
    return `<div class="strip">${strip}</div>
      <div class="daycard">${editorHTML(i)}</div>`;
  }

  /* ---------- Tages-Editor ---------- */

  function chipsHTML(i) {
    const c = [];
    if (i.target > 0) {
      c.push(`<span class="chip sand">Soll ${T.fmt(i.target)} h</span>`);
      if (i.pause) c.push(`<span class="chip">+ ${i.pause} min Pause</span>`, `<span class="chip">Anwesenheit ${T.fmt(i.presence)} h</span>`);
    } else if (!i.holiday) c.push('<span class="chip">Kein Arbeitstag · alles zählt als Überstunden</span>');
    return c.length ? `<div class="chips">${c.join('')}</div>` : '';
  }

  function editorHTML(i) {
    const s = state.data.settings;
    if (i.beforeStart) {
      return `<p class="empty">Vor deinem Arbeitsbeginn am ${longDate(T.parseKey(s.startDate))} – hier gibt es nichts zu erfassen.</p>`;
    }
    const parts = [chipsHTML(i)];
    if (i.holiday) {
      parts.push(`<div class="banner">${ICON.flag}<span><b>${esc(i.holiday)}</b>Gesetzlicher Feiertag – kein Soll. Arbeit an diesem Tag zählt komplett als Überstunden.</span></div>`);
    }
    if (i.vacation) {
      parts.push(`<div class="state vac">${ICON.sun}<div><b>Urlaubstag</b>${i.credit ? `${T.fmt(i.credit, true)} h als Überstunden gutgeschrieben` : 'Soll gilt als erfüllt'}</div></div>
        <button class="btn line" data-act="vac-off" data-key="${i.key}">Urlaub entfernen</button>`);
      return parts.join('');
    }
    if (i.overtime) {
      parts.push(`<div class="state ot">${ICON.glass}<div><b>Überstunden angerechnet</b>${T.fmt(-i.used)} h vom Saldo${i.hasWork ? ` · ${T.fmt(i.worked)} h gearbeitet` : ''}</div></div>
        <button class="btn line" data-act="ot-off" data-key="${i.key}">Anrechnung rückgängig machen</button>`);
    }
    const form = formHTML(i);
    parts.push(i.overtime && !i.hasWork ? `<details class="more"><summary>Doch teilweise gearbeitet? Zeit eintragen</summary>${form}</details>` : form);
    if (i.target > 0) parts.push(actionsHTML(i));
    return parts.join('');
  }

  function formHTML(i) {
    const w = i.entry.work || T.defaultWork(state.data, i.key);
    const mode = w.mode === 'duration' ? 'duration' : 'range';
    const fallback = T.defaultWork(state.data, i.key);
    const start = w.start || fallback.start;
    const pause = w.pause != null ? w.pause : fallback.pause;
    const end = w.end || fallback.end;
    const minutes = mode === 'duration' ? w.minutes : T.workedMinutes({ start, end, pause });
    const worked = T.workedMinutes(mode === 'duration' ? { mode, minutes } : { mode, start, end, pause });
    return `<div class="form" data-key="${i.key}" data-mode="${mode}" data-pause="${pause}">
      <div class="form-head">
        <h3>Arbeitszeit</h3>
        <div class="seg mini">
          <button class="${mode === 'range' ? 'on' : ''}" data-act="mode" data-mode="range">Von–Bis</button>
          <button class="${mode === 'duration' ? 'on' : ''}" data-act="mode" data-mode="duration">Dauer</button>
        </div>
      </div>
      <div class="f-range">
        <label class="field"><span>Beginn</span><input type="time" name="start" value="${start}"></label>
        <label class="field"><span>Ende</span><input type="time" name="end" value="${end}"></label>
        <div class="field wide"><span>Pause</span>
          <div class="stepper">
            <button type="button" data-act="pause" data-d="-15" aria-label="Pause kürzer">−</button>
            <output>${pause} min</output>
            <button type="button" data-act="pause" data-d="15" aria-label="Pause länger">+</button>
          </div>
        </div>
      </div>
      <div class="f-dur">
        <label class="field"><span>Arbeitszeit netto (Std:Min)</span><input type="time" name="dur" value="${T.toHHMM(minutes)}"></label>
      </div>
      <div class="f-result">${resultHTML(i, worked)}</div>
      <div class="f-actions">
        ${i.hasWork ? '<button class="btn line danger" data-act="work-del">Löschen</button>' : ''}
        <button class="btn primary" data-act="work-save">${i.hasWork ? 'Aktualisieren' : 'Speichern'}</button>
      </div>
    </div>`;
  }

  function resultHTML(i, worked, invalid) {
    const diff = worked - i.target;
    let chip;
    if (invalid) chip = `<span class="chip neg">${invalid}</span>`;
    else if (worked <= 0) chip = '<span class="chip">Noch keine Zeit</span>';
    else if (diff > 0) chip = `<span class="chip pos">${T.fmt(diff, true)} h Überstunden</span>`;
    else if (diff === 0) chip = '<span class="chip pos">Soll erfüllt</span>';
    else if (i.overtime) chip = `<span class="chip ot">Rest ${T.fmt(-diff)} h aus Überstunden</span>`;
    else chip = `<span class="chip">${T.fmt(-diff)} h unter Soll · kein Abzug</span>`;
    return `<div class="res"><span>Netto</span><b>${invalid ? '–' : T.fmt(worked)}<small> h</small></b></div>${chip}`;
  }

  function actionsHTML(i) {
    const s = state.data.settings;
    const out = [];
    if (!i.overtime) {
      const need = Math.max(0, i.target - i.worked);
      const total = T.balance(state.data);
      const after = total - need;
      const text = need
        ? `${i.hasWork ? 'Die fehlende Zeit' : 'Der ganze Tag'} wird mit deinen Überstunden verrechnet: ${T.fmt(total, true)} h → ${T.fmt(after, true)} h.${after < 0 ? ' <em>Der Saldo wird negativ.</em>' : ''}`
        : 'Das Soll ist an diesem Tag schon erfüllt.';
      out.push(`<div class="act ot">
        <div class="act-head"><span>Überstunden anrechnen</span><b>${need ? `${T.fmt(-need)} h` : '–'}</b></div>
        <p>${text}</p>
        <button class="btn ot" data-act="ot-on" data-key="${i.key}"${need ? '' : ' disabled'}>Überstunden anrechnen</button>
      </div>`);
    }
    const y = i.date.getFullYear();
    const vs = T.vacationSummary(state.data, y, todayKey());
    const left = vs.remaining - 1;
    out.push(`<div class="act vac">
      <div class="act-head"><span>Urlaub nehmen</span><b>${s.vacationCredit ? `${T.fmt(i.target, true)} h` : '1 Tag'}</b></div>
      <p>Ganzer Tag${s.vacationCredit ? `, ${T.fmt(i.target)} h werden als Überstunden gutgeschrieben` : ''}. Resturlaub ${y}: ${T.num(vs.remaining)} → ${T.num(left)} ${plural(left, 'Tag', 'Tage')}.${left < 0 ? ' <em>Mehr als dein Anspruch.</em>' : ''}</p>
      <button class="btn vac" data-act="vac-on" data-key="${i.key}">Urlaub eintragen</button>
    </div>`);
    return `<div class="acts">${out.join('')}</div>`;
  }

  // Formularwerte lesen
  function formWork(form) {
    const val = (n) => ($(`[name="${n}"]`, form) || {}).value || '';
    if (form.dataset.mode === 'duration') return { mode: 'duration', minutes: T.toMin(val('dur')) };
    return { mode: 'range', start: val('start'), end: val('end'), pause: Number(form.dataset.pause) || 0 };
  }

  function formProblem(w) {
    if (w.mode === 'duration') return w.minutes > 0 ? '' : 'Bitte eine Arbeitszeit angeben';
    if (!w.start || !w.end) return 'Bitte Beginn und Ende angeben';
    if (T.toMin(w.end) <= T.toMin(w.start)) return 'Ende liegt vor dem Beginn';
    if (T.workedMinutes(w) <= 0) return 'Pause ist länger als die Arbeitszeit';
    return '';
  }

  function updateResult(form) {
    const i = T.dayInfo(state.data, form.dataset.key);
    const w = formWork(form);
    const problem = w.mode === 'range' ? formProblem(w) : '';
    $('.f-result', form).innerHTML = resultHTML(i, T.workedMinutes(w), problem);
  }

  function setMode(btn) {
    const form = btn.closest('.form');
    const mode = btn.dataset.mode;
    if (form.dataset.mode === mode) return;
    const w = formWork(form);
    if (mode === 'duration') {
      const m = T.workedMinutes(w);
      if (m > 0) $('[name="dur"]', form).value = T.toHHMM(m);
    } else {
      const start = $('[name="start"]', form).value || state.data.settings.dayStart;
      $('[name="end"]', form).value = T.toHHMM(T.toMin(start) + w.minutes + (Number(form.dataset.pause) || 0));
    }
    form.dataset.mode = mode;
    form.querySelectorAll('[data-act="mode"]').forEach((b) => b.classList.toggle('on', b === btn));
    updateResult(form);
  }

  function stepPause(btn) {
    const form = btn.closest('.form');
    const p = Math.max(0, Math.min(180, (Number(form.dataset.pause) || 0) + Number(btn.dataset.d)));
    form.dataset.pause = p;
    $('output', btn.parentNode).textContent = `${p} min`;
    updateResult(form);
  }

  function saveWork(form) {
    const k = form.dataset.key;
    const w = formWork(form);
    const problem = formProblem(w);
    if (problem) return toast(problem);
    const worked = T.workedMinutes(w);
    const diff = worked - T.dayInfo(state.data, k).target;
    const msg = `${T.fmt(worked)} h gespeichert${diff > 0 ? ` · ${T.fmt(diff, true)} h Überstunden` : ''}`;
    mutate(msg, (d) => T.setWork(d, k, w));
    if (state.sheet) closeSheet();
  }

  /* ---------- Bottom-Sheet ---------- */

  function openSheet(k) {
    state.sheet = k;
    document.documentElement.classList.add('sheet-open');
    renderSheet(true);
  }

  function closeSheet() {
    state.sheet = null;
    document.documentElement.classList.remove('sheet-open');
    const sheet = $('.sheet', $sheetRoot);
    if (!sheet) return;
    sheet.style.transform = '';
    sheet.classList.add('closing');
    $('.sheet-backdrop', $sheetRoot).classList.add('closing');
    setTimeout(() => { if (!state.sheet) $sheetRoot.innerHTML = ''; }, 230);
  }

  function renderSheet(fresh) {
    const k = state.sheet;
    if (!k) return;
    const i = T.dayInfo(state.data, k);
    const head = `<div class="sheet-head">
      <div class="sh-nav">
        <button class="iconbtn" data-act="sheet-nav" data-d="-1" aria-label="Vorheriger Tag">${ICON.chevL}</button>
        <button class="iconbtn" data-act="sheet-nav" data-d="1" aria-label="Nächster Tag">${ICON.chevR}</button>
      </div>
      <div class="sh-title"><span class="sh-wd">${T.WD_LONG[i.weekday]}</span><span class="sh-date">${longDate(i.date)}</span></div>
      <button class="sh-done" data-act="close">Fertig</button>
    </div>`;
    const existing = $('.sheet', $sheetRoot);
    if (fresh || !existing || existing.classList.contains('closing')) {
      $sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close"></div>
        <div class="sheet" role="dialog" aria-modal="true" aria-label="Tag bearbeiten">
          <div class="grabber" data-drag></div>
          <div class="sh-headwrap" data-drag>${head}</div>
          <div class="sheet-body">${editorHTML(i)}</div>
        </div>`;
    } else {
      $('.sh-headwrap', existing).innerHTML = head;
      $('.sheet-body', existing).innerHTML = editorHTML(i);
    }
  }

  /* ---------- Überstunden ---------- */

  function overtimeTab() {
    const y = year();
    const s = state.data.settings;
    const ys = T.yearSummary(state.data, y);
    const sd = T.parseKey(s.startDate);

    const ledger = `<div class="card">
      <h3>Zeitkonto ${y}</h3>
      <dl class="ledger">
        <div><dt>${y <= startYear() ? 'Startsaldo' : `Übertrag aus ${y - 1}`}</dt><dd>${T.fmt(ys.carry, true)}</dd></div>
        <div><dt>Mehrarbeit</dt><dd class="pos">${T.fmt(ys.gained, true)}</dd></div>
        ${s.vacationCredit || ys.credit ? `<div><dt>Urlaubsgutschrift</dt><dd class="pos">${T.fmt(ys.credit, true)}</dd></div>` : ''}
        <div><dt>Überstunden genommen</dt><dd class="${ys.used ? 'neg' : ''}">${T.fmt(-ys.used)}</dd></div>
        <div class="total"><dt>Saldo Ende ${y}</dt><dd class="${ys.end < 0 ? 'neg' : ''}">${T.fmt(ys.end, true)} h</dd></div>
      </dl>
    </div>`;

    const peak = Math.max(60, ...ys.months.map((m) => Math.max(m.gained + m.credit, m.used)));
    const pct = (v) => Math.round((v / peak) * 100);
    const rows = ys.months.map((m, idx) => {
      // Monate vor dem Arbeitsbeginn ausblenden
      if (y < sd.getFullYear() || (y === sd.getFullYear() && idx < sd.getMonth())) return '';
      const net = m.gained + m.credit - m.used;
      const any = m.gained || m.credit || m.used;
      return `<div class="mc${any ? '' : ' off'}">
        <span class="mc-m">${T.MONTHS_SHORT[idx]}</span>
        <span class="mc-track">
          <span class="mc-neg"><i style="width:${pct(m.used)}%"></i></span>
          <span class="mc-pos"><i class="g" style="width:${pct(m.gained)}%"></i><i class="c" style="width:${pct(m.credit)}%"></i></span>
        </span>
        <span class="mc-v ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${any ? T.fmt(net, true) : '–'}</span>
      </div>`;
    }).join('');
    const chart = `<div class="card">
      <h3>Monate ${y}</h3>
      ${rows ? `<div class="mchart">${rows}</div>` : `<p class="empty">${y} liegt vor deinem Arbeitsbeginn.</p>`}
      <div class="chart-legend">
        <span><i style="background:var(--green)"></i>Mehrarbeit</span>
        <span><i style="background:var(--teal)"></i>Urlaubsgutschrift</span>
        <span><i style="background:var(--rust)"></i>genommen</span>
      </div>
    </div>`;

    const items = ys.bookings.slice().reverse().map((i) => {
      let what, detail;
      if (i.vacation) { what = 'Urlaubsgutschrift'; detail = `Urlaubstag · Soll ${T.fmt(i.target)} h`; }
      else if (i.used) { what = 'Überstunden genommen'; detail = i.hasWork ? `${T.fmt(i.worked)} h gearbeitet, Rest angerechnet` : `Ganzer Tag · Soll ${T.fmt(i.target)} h`; }
      else { what = 'Mehrarbeit'; detail = `${T.fmt(i.worked)} h gearbeitet · Soll ${T.fmt(i.target)} h`; }
      return `<button class="li" data-act="open" data-key="${i.key}">
        <span class="li-date"><b>${ddmm(i.date)}</b><span>${T.WD_SHORT[i.weekday]}</span></span>
        <span class="li-what">${what}<small>${detail}</small></span>
        <span class="li-val ${i.delta > 0 ? 'pos' : 'neg'}">${T.fmt(i.delta, true)}</span>
      </button>`;
    }).join('');
    const list = `<div class="card">
      <h3>Buchungen ${y}</h3>
      ${items ? `<div class="list">${items}</div>` : `<p class="empty">Noch keine Buchungen in ${y}. Alles, was du über dem Soll arbeitest, landet automatisch hier.</p>`}
    </div>`;

    const rules = `<div class="card">
      <h3>So wird gerechnet</h3>
      <ul class="rules">
        <li style="--c:var(--green)">Mehr als das Soll gearbeitet: Die Differenz kommt aufs Konto.</li>
        <li style="--c:var(--sand)">Weniger gearbeitet: Es wird nichts abgezogen.</li>
        <li style="--c:var(--teal)">${s.vacationCredit ? 'Urlaubstag: Das Tages-Soll wird gutgeschrieben (Mo +4 h, Di/Do +8 h).' : 'Urlaubstag: zählt neutral.'}</li>
        <li style="--c:var(--rust)">Überstunden anrechnen: Die fehlende Soll-Zeit wird abgezogen.</li>
      </ul>
    </div>`;

    return ledger + chart + list + rules;
  }

  /* ---------- Urlaub ---------- */

  function vacationTab() {
    const y = year();
    const s = state.data.settings;
    const tk = todayKey();
    const vs = T.vacationSummary(state.data, y, tk);

    const slots = Math.max(Math.ceil(vs.total), vs.used);
    let tickets = '';
    for (let n = 0; n < slots; n++) {
      let cls = n < vs.taken ? 'taken' : n < vs.used ? 'planned' : 'free';
      if (cls !== 'free' && n >= vs.total) cls += ' over';
      if (cls === 'free' && vs.total % 1 && n === Math.floor(vs.total)) cls += ' half';
      tickets += `<i class="vt ${cls}"></i>`;
    }
    const overview = `<div class="card">
      <h3>Urlaubstage ${y}</h3>
      ${tickets ? `<div class="vtickets">${tickets}</div>` : '<p class="empty">In diesem Jahr besteht kein Urlaubsanspruch.</p>'}
      <div class="vlegend">
        <span><i class="vt taken"></i>${vs.taken} genommen</span>
        <span><i class="vt planned"></i>${vs.planned} geplant</span>
        <span><i class="vt free"></i>${T.num(Math.max(0, vs.remaining))} frei</span>
      </div>
    </div>`;

    const calc = `${vs.months} ${plural(vs.months, 'Monat', 'Monate')} × ${T.num(s.vacationPerMonth)} = ${T.num(vs.raw)}${vs.raw !== vs.entitled ? ` → aufgerundet ${vs.entitled}` : ''}`;
    const next = T.vacationEntitlement(s, y + 1);
    const ledger = `<div class="card">
      <h3>Anspruch ${y}</h3>
      <dl class="ledger">
        <div><dt>Anspruch<small>${calc}</small></dt><dd>${vs.entitled}</dd></div>
        <div><dt>Übertrag / Korrektur</dt><dd>
          <div class="stepper inline">
            <button data-act="vadj" data-d="-0.5" aria-label="Korrektur verringern">−</button>
            <output>${vs.adjust > 0 ? '+' : ''}${T.num(vs.adjust)}</output>
            <button data-act="vadj" data-d="0.5" aria-label="Korrektur erhöhen">+</button>
          </div>
        </dd></div>
        <div><dt>Genommen</dt><dd>${vs.taken}</dd></div>
        <div><dt>Geplant</dt><dd>${vs.planned}</dd></div>
        <div class="total"><dt>Verbleibend</dt><dd class="${vs.remaining < 0 ? 'neg' : ''}">${T.num(vs.remaining)} ${plural(vs.remaining, 'Tag', 'Tage')}</dd></div>
      </dl>
      <p class="foot">${y + 1}: ${next.days} Tage Anspruch (${next.months} × ${T.num(s.vacationPerMonth)}).</p>
    </div>`;

    const ck = T.keyOf(state.cursor);
    const form = `<div class="card vrange">
      <h3>Urlaub eintragen</h3>
      <div class="two">
        <label class="field"><span>Von</span><input type="date" name="vfrom" value="${ck}" min="${s.startDate}"></label>
        <label class="field"><span>Bis</span><input type="date" name="vto" value="${ck}" min="${s.startDate}"></label>
      </div>
      <p class="hint" id="vhint">${vacHint(ck, ck)}</p>
      <button class="btn vac" data-act="vac-range">Urlaub eintragen</button>
    </div>`;

    const items = vs.entries.map((i) => `<button class="li" data-act="open" data-key="${i.key}">
        <span class="li-date"><b>${ddmm(i.date)}</b><span>${T.WD_SHORT[i.weekday]}</span></span>
        <span class="li-what">${i.key <= tk ? 'Genommen' : 'Geplant'}<small>${i.credit ? `${T.fmt(i.credit, true)} h gutgeschrieben` : `Soll ${T.fmt(i.target)} h`}</small></span>
        <span class="li-val vac">1 Tag</span>
      </button>`).join('');
    const list = `<div class="card">
      <h3>Deine Urlaubstage ${y}</h3>
      ${items ? `<div class="list">${items}</div>` : '<p class="empty">Noch kein Urlaub eingetragen. Tippe im Kalender auf einen Arbeitstag oder nutze das Formular oben.</p>'}
    </div>`;

    return overview + ledger + form + list;
  }

  function vacHint(from, to) {
    if (!from || !to) return 'Bitte Zeitraum wählen.';
    const [a, b] = from <= to ? [from, to] : [to, from];
    const keys = T.workdaysInRange(state.data, a, b);
    const open = keys.filter((k) => !T.dayInfo(state.data, k).vacation);
    if (!keys.length) return 'Kein Arbeitstag in diesem Zeitraum.';
    const credit = open.reduce((sum, k) => sum + T.dayInfo(state.data, k).target, 0);
    const already = keys.length - open.length;
    let t = `${open.length} ${plural(open.length, 'Arbeitstag', 'Arbeitstage')}`;
    if (state.data.settings.vacationCredit && open.length) t += ` · ${T.fmt(credit, true)} h Gutschrift`;
    if (already) t += ` · ${already} schon eingetragen`;
    t += '. Freie Tage und Feiertage zählen nicht.';
    // Reicht der Resturlaub im jeweiligen Jahr?
    const perYear = {};
    open.forEach((k) => { perYear[k.slice(0, 4)] = (perYear[k.slice(0, 4)] || 0) + 1; });
    for (const [y, n] of Object.entries(perYear)) {
      const left = T.vacationSummary(state.data, Number(y), todayKey()).remaining;
      if (n <= left) continue;
      t += left > 0
        ? ` Achtung: ${y} sind nur noch ${T.num(left)} ${plural(left, 'Tag', 'Tage')} übrig.`
        : ` Achtung: Für ${y} ist kein Resturlaub mehr übrig.`;
    }
    return t;
  }

  function updateVacHint() {
    const hint = $('#vhint');
    if (hint) hint.textContent = vacHint($('[name="vfrom"]').value, $('[name="vto"]').value);
  }

  function bookVacationRange() {
    const from = $('[name="vfrom"]').value, to = $('[name="vto"]').value;
    if (!from || !to) return toast('Bitte Zeitraum wählen');
    const [a, b] = from <= to ? [from, to] : [to, from];
    const keys = T.workdaysInRange(state.data, a, b).filter((k) => !T.dayInfo(state.data, k).vacation);
    if (!keys.length) return toast('Keine freien Arbeitstage im Zeitraum');
    mutate(`${keys.length} ${plural(keys.length, 'Urlaubstag', 'Urlaubstage')} eingetragen`, (d) => keys.forEach((k) => T.setVacation(d, k, true)));
  }

  /* ---------- Einstellungen ---------- */

  function settingsTab() {
    const s = state.data.settings;
    const weekly = s.schedule.reduce((a, b) => a + b, 0);
    const sollOpts = (val) => {
      const vals = [];
      for (let m = 0; m <= 720; m += 15) vals.push(m);
      if (!vals.includes(val)) vals.push(val);
      return vals.sort((a, b) => a - b).map((m) => `<option value="${m}"${m === val ? ' selected' : ''}>${m ? `${T.fmt(m)} h` : 'frei'}</option>`).join('');
    };
    const pauseOpts = (val) => {
      const vals = [0, 15, 30, 45, 60, 75, 90];
      if (!vals.includes(val)) vals.push(val);
      return vals.sort((a, b) => a - b).map((m) => `<option value="${m}"${m === val ? ' selected' : ''}>${m} min</option>`).join('');
    };
    const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => `<div class="srow${s.schedule[wd] ? ' work' : ''}">
        <span class="sr-day">${T.WD_LONG[wd]}</span>
        <select data-set="schedule.${wd}" aria-label="Soll ${T.WD_LONG[wd]}">${sollOpts(s.schedule[wd])}</select>
        <select data-set="breaks.${wd}" aria-label="Pause ${T.WD_LONG[wd]}"${s.schedule[wd] ? '' : ' disabled'}>${pauseOpts(s.breaks[wd])}</select>
      </div>`).join('');
    const states = Object.entries(T.STATES).map(([k, n]) => `<option value="${k}"${k === s.state ? ' selected' : ''}>${n}</option>`).join('');

    return `
      <h2 class="group-title">Arbeitszeitmodell</h2>
      <div class="group">
        <div class="srow head"><span></span><span>Soll</span><span>Pause</span></div>
        ${rows}
        <div class="srow total"><span class="sr-day">Pro Woche</span><b>${T.fmt(weekly)} h</b><span></span></div>
      </div>
      <p class="group-foot">Soll = reine Arbeitszeit. Die Pause kommt nur zur Anwesenheit dazu (8:00 h + 30 min = 8:30 h vor Ort).</p>

      <h2 class="group-title">Allgemein</h2>
      <div class="group">
        <label class="row"><span>Beschäftigt seit</span><input type="date" data-set="startDate" value="${s.startDate}"></label>
        <label class="row"><span>Üblicher Arbeitsbeginn</span><input type="time" data-set="dayStart" value="${s.dayStart}"></label>
        <label class="row"><span>Feiertage</span><select data-set="state">${states}</select></label>
      </div>

      <h2 class="group-title">Urlaub</h2>
      <div class="group">
        <label class="row"><span>Urlaubstage pro Monat</span><input type="text" inputmode="decimal" data-set="vacationPerMonth" value="${T.num(s.vacationPerMonth)}"></label>
        <label class="row"><span>Urlaub als Überstunden gutschreiben</span><input type="checkbox" class="switch" data-set="vacationCredit"${s.vacationCredit ? ' checked' : ''}></label>
      </div>
      <p class="group-foot">An: Ein Urlaubstag schreibt dein Tages-Soll als Überstunden gut (Montag +4 h, Dienstag/Donnerstag +8 h). Aus: Urlaub zählt neutral.</p>

      <h2 class="group-title">Überstunden</h2>
      <div class="group">
        <div class="row"><span>Startsaldo</span>
          <div class="stepper inline">
            <button data-act="init-ot" data-d="-30" aria-label="Startsaldo verringern">−</button>
            <output data-act="init-ot-edit" role="button" tabindex="0">${T.fmt(s.initialOvertime, true)} h</output>
            <button data-act="init-ot" data-d="30" aria-label="Startsaldo erhöhen">+</button>
          </div>
        </div>
      </div>
      <p class="group-foot">Für Überstunden, die du vor TimeTrack schon hattest. Auf den Wert tippen, um ihn direkt einzugeben.</p>

      <h2 class="group-title">Daten</h2>
      <div class="group">
        <button class="row link" data-act="export"><span>Backup exportieren</span>${ICON.share}</button>
        <button class="row link" data-act="import"><span>Backup importieren</span>${ICON.download}</button>
        <button class="row link danger" data-act="reset"><span>Alle Daten löschen</span></button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="group-foot">Deine Daten bleiben nur auf diesem Gerät. Sichere ab und zu ein Backup, z. B. in der Dateien-App.</p>
      ${installCard()}
      <p class="about">TimeTrack 1.0</p>`;
  }

  function applySetting(el) {
    const s = state.data.settings;
    const key = el.dataset.set;
    if (key === 'startDate') {
      if (!el.value) return;
      s.startDate = el.value;
    } else if (key === 'dayStart') {
      s.dayStart = el.value || '08:00';
    } else if (key === 'vacationPerMonth') {
      const v = parseFloat(String(el.value).replace(',', '.'));
      if (!(v >= 0 && v <= 5)) {
        el.value = T.num(s.vacationPerMonth);
        return toast('Bitte einen Wert zwischen 0 und 5');
      }
      s.vacationPerMonth = v;
    } else if (key === 'vacationCredit') {
      s.vacationCredit = el.checked;
    } else if (key === 'state') {
      s.state = el.value;
    } else {
      const m = key.match(/^(schedule|breaks)\.(\d)$/);
      if (!m) return;
      s[m[1]][Number(m[2])] = Number(el.value);
    }
    persist();
    clampCursor();
    render();
    toast('Gespeichert');
  }

  function adjustInitial(delta) {
    const s = state.data.settings;
    s.initialOvertime += delta;
    persist();
    render();
  }

  function editInitial() {
    const s = state.data.settings;
    const input = window.prompt('Startsaldo der Überstunden (z. B. 3:30 oder -1:15)', T.fmt(s.initialOvertime).replace('−', '-'));
    if (input == null) return;
    const v = T.parseHM(input);
    if (Number.isNaN(v)) return toast('Format z. B. 3:30 oder -1:15');
    s.initialOvertime = v;
    persist();
    render();
    toast('Startsaldo gespeichert');
  }

  function adjustVacation(delta) {
    const y = year();
    const adj = state.data.settings.vacationAdjust;
    const v = Math.round(((Number(adj[y]) || 0) + delta) * 2) / 2;
    if (v) adj[y] = v;
    else delete adj[y];
    persist();
    render();
  }

  async function exportData() {
    const json = JSON.stringify({ app: 'TimeTrack', exported: new Date().toISOString(), ...state.data }, null, 2);
    const name = `timetrack-backup-${todayKey()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'TimeTrack Backup' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup gespeichert');
  }

  function importFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        if (!raw || typeof raw !== 'object' || typeof raw.days !== 'object') throw new Error('kein Backup');
        const n = Object.keys(raw.days).length;
        if (!window.confirm(`Backup mit ${n} ${plural(n, 'Eintrag', 'Einträgen')} laden? Die aktuellen Daten werden ersetzt.`)) return;
        replaceData(T.normalize(raw), `${n} ${plural(n, 'Eintrag', 'Einträge')} importiert`);
      } catch (e) {
        toast('Das ist kein gültiges TimeTrack-Backup');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(f);
  }

  function resetAll() {
    if (!window.confirm('Wirklich alle Einträge und Einstellungen löschen?')) return;
    replaceData(T.normalize(null), 'Alle Daten gelöscht');
  }

  function installCard() {
    if (isStandalone) return '';
    return `<h2 class="group-title">Als App installieren</h2>
      <div class="group"><div class="row note">Öffne TimeTrack in Safari, tippe auf Teilen ${ICON.share} und dann auf „Zum Home-Bildschirm“. Die App startet danach im Vollbild – mit eigenem Symbol.</div></div>`;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  function installBanner() {
    if (isStandalone || !isIOS || uiPrefs.hideInstall) return '';
    return `<div class="install">${ICON.share}<span><b>Als App installieren</b>Teilen → „Zum Home-Bildschirm“</span>
      <button class="x" data-act="hide-install" aria-label="Hinweis ausblenden">×</button></div>`;
  }

  /* ---------- Änderungen, Rückgängig, Toast ---------- */

  function mutate(message, fn) {
    const before = JSON.stringify(state.data);
    fn(state.data);
    state.undo = before;
    persist();
    refresh();
    toast(message, true);
  }

  function replaceData(data, message) {
    state.undo = JSON.stringify(state.data);
    state.data = data;
    persist();
    clampCursor();
    refresh();
    toast(message, true);
  }

  function undo() {
    if (!state.undo) return;
    state.data = T.normalize(JSON.parse(state.undo));
    state.undo = null;
    persist();
    clampCursor();
    refresh();
    toast('Rückgängig gemacht');
  }

  let toastTimer;
  function toast(message, withUndo) {
    $toast.innerHTML = `<span>${esc(message)}</span>${withUndo ? '<button data-act="undo">Rückgängig</button>' : ''}`;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), withUndo ? 5000 : 2200);
  }

  /* ---------- Navigation ---------- */

  function setTab(tab) {
    if (state.tab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    state.tab = tab;
    persistUI();
    render();
    window.scrollTo(0, 0);
  }

  function setYear(y) {
    y = Math.max(minYear(), Math.min(maxYear(), y));
    const c = state.cursor;
    state.cursor = new Date(y, c.getMonth(), Math.min(c.getDate(), T.daysInMonth(y, c.getMonth())));
    render();
  }

  function navigate(dir) {
    const c = state.cursor;
    if (state.view === 'month') state.cursor = T.addMonths(c, dir);
    else if (state.view === 'week') state.cursor = T.addDays(c, 7 * dir);
    else state.cursor = T.addDays(c, dir);
    clampCursor();
    render();
  }

  /* ---------- Ereignisse ---------- */

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const k = t.dataset.key;
    switch (t.dataset.act) {
      case 'tab': setTab(t.dataset.tab); break;
      case 'view': state.view = t.dataset.view; persistUI(); render(); break;
      case 'nav': navigate(Number(t.dataset.d)); break;
      case 'today': state.cursor = today(); render(); break;
      case 'year': setYear(year() + Number(t.dataset.d)); break;
      case 'open': openSheet(k); break;
      case 'pick': state.cursor = T.parseKey(k); render(); break;
      case 'close': closeSheet(); break;
      case 'sheet-nav':
        state.sheet = T.keyOf(T.addDays(T.parseKey(state.sheet), Number(t.dataset.d)));
        renderSheet();
        break;
      case 'mode': setMode(t); break;
      case 'pause': stepPause(t); break;
      case 'work-save': saveWork(t.closest('.form')); break;
      case 'work-del': {
        const key = t.closest('.form').dataset.key;
        mutate('Arbeitszeit gelöscht', (d) => T.setWork(d, key, null));
        break;
      }
      case 'ot-on': mutate('Überstunden angerechnet', (d) => T.setOvertime(d, k, true)); break;
      case 'ot-off': mutate('Anrechnung rückgängig gemacht', (d) => T.setOvertime(d, k, false)); break;
      case 'vac-on': mutate('Urlaub eingetragen', (d) => T.setVacation(d, k, true)); break;
      case 'vac-off': mutate('Urlaub entfernt', (d) => T.setVacation(d, k, false)); break;
      case 'vac-range': bookVacationRange(); break;
      case 'vadj': adjustVacation(Number(t.dataset.d)); break;
      case 'init-ot': adjustInitial(Number(t.dataset.d)); break;
      case 'init-ot-edit': editInitial(); break;
      case 'export': exportData(); break;
      case 'import': $('#import-file').click(); break;
      case 'reset': resetAll(); break;
      case 'undo': undo(); break;
      case 'hide-install': uiPrefs.hideInstall = true; persistUI(); renderMain(); break;
    }
  });

  document.addEventListener('input', (ev) => {
    const form = ev.target.closest('.form');
    if (form) updateResult(form);
    else if (ev.target.closest('.vrange')) updateVacHint();
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.set) applySetting(el);
    else if (el.id === 'import-file') importFile(el);
    else if (el.closest('.form')) updateResult(el.closest('.form'));
    else if (el.closest('.vrange')) updateVacHint();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && state.sheet) closeSheet();
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('output[data-act]')) {
      ev.preventDefault();
      ev.target.click();
    }
  });

  // Wischgesten: Kalender links/rechts blättern, Sheet nach unten schließen
  let swipe = null;
  let drag = null;
  document.addEventListener('touchstart', (ev) => {
    const p = ev.touches[0];
    if (state.sheet && ev.target.closest('[data-drag]')) {
      drag = { y: p.clientY, dy: 0, el: $('.sheet', $sheetRoot) };
      if (drag.el) drag.el.style.transition = 'none';
    } else if (!state.sheet && ev.target.closest('[data-swipe]') && !ev.target.closest('input, select')) {
      swipe = { x: p.clientX, y: p.clientY, t: Date.now() };
    }
  }, { passive: true });

  document.addEventListener('touchmove', (ev) => {
    if (!drag || !drag.el) return;
    drag.dy = Math.max(0, ev.touches[0].clientY - drag.y);
    drag.el.style.transform = `translateY(${drag.dy}px)`;
  }, { passive: true });

  document.addEventListener('touchend', (ev) => {
    const p = ev.changedTouches[0];
    if (drag) {
      const { el, dy } = drag;
      drag = null;
      if (!el) return;
      el.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.25, 1)';
      if (dy > 110) closeSheet();
      else el.style.transform = '';
      return;
    }
    if (swipe) {
      const dx = p.clientX - swipe.x, dy = p.clientY - swipe.y;
      const quick = Date.now() - swipe.t < 600;
      swipe = null;
      if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) navigate(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  // Neuer Tag, während die App im Hintergrund lag → "Heute" aktualisieren
  let lastDay = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || todayKey() === lastDay) return;
    lastDay = todayKey();
    refresh();
  });

  /* ---------- Start ---------- */

  render();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
