/* TimeTrack – Rechenkern.
   Reine Funktionen ohne DOM, damit sie im Browser und in Node (Tests) laufen. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TT = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ---------- Datum ---------- */

  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const addMonths = (d, n) => {
    const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const y = first.getFullYear(), m = first.getMonth();
    return new Date(y, m, Math.min(d.getDate(), daysInMonth(y, m)));
  };
  // Wochen beginnen am Montag
  const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
  }

  const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  /* ---------- Zeit & Formatierung ---------- */

  const toMin = (hhmm) => {
    if (!hhmm || typeof hhmm !== 'string') return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toHHMM = (min) => {
    const v = Math.max(0, Math.min(1439, Math.round(min)));
    return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
  };
  // Minuten → "8:30", mit sign=true → "+0:30" / "−1:15"
  function fmt(min, sign) {
    const v = Math.round(min);
    const a = Math.abs(v);
    const s = `${Math.floor(a / 60)}:${pad(a % 60)}`;
    if (v < 0) return '−' + s;
    return sign && v > 0 ? '+' + s : s;
  }
  // Kompakt für Kalenderzellen: "4h", "8h", "7:30"
  const fmtShort = (min) => (min % 60 === 0 ? `${min / 60}h` : fmt(min));
  // Zahl mit deutschem Komma und echtem Minus: 4.5 → "4,5", -2 → "−2"
  const num = (x) => String(Math.round(x * 100) / 100).replace('.', ',').replace('-', '−');
  // "3:30", "-1:15", "2,5", "+4" → Minuten (NaN bei Unsinn)
  function parseHM(str) {
    const s = String(str || '').trim().replace('−', '-').replace(/\s/g, '');
    let m = s.match(/^([+-]?)(\d{1,4}):([0-5]\d)$/);
    if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    m = s.match(/^([+-]?)(\d{1,4}(?:[.,]\d+)?)$/);
    if (m) return (m[1] === '-' ? -1 : 1) * Math.round(parseFloat(m[2].replace(',', '.')) * 60);
    return NaN;
  }

  /* ---------- Feiertage ---------- */

  const STATES = {
    '': 'Nur bundesweit',
    BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen',
    HH: 'Hamburg', HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen',
    NW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen',
    ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
  };

  // Ostersonntag nach dem anonymen gregorianischen Algorithmus
  function easterSunday(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  const holidayCache = new Map();
  function holidays(y, state) {
    const ck = `${y}|${state || ''}`;
    if (holidayCache.has(ck)) return holidayCache.get(ck);
    const map = new Map();
    const add = (d, name, states) => {
      if (!states || states.includes(state)) map.set(keyOf(d), name);
    };
    const fix = (m, d) => new Date(y, m - 1, d);
    const easter = easterSunday(y);

    add(fix(1, 1), 'Neujahr');
    add(fix(1, 6), 'Heilige Drei Könige', ['BW', 'BY', 'ST']);
    add(fix(3, 8), 'Internationaler Frauentag', ['BE', 'MV']);
    add(addDays(easter, -2), 'Karfreitag');
    add(addDays(easter, 1), 'Ostermontag');
    add(fix(5, 1), 'Tag der Arbeit');
    add(addDays(easter, 39), 'Christi Himmelfahrt');
    add(addDays(easter, 50), 'Pfingstmontag');
    add(addDays(easter, 60), 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']);
    add(fix(8, 15), 'Mariä Himmelfahrt', ['BY', 'SL']);
    add(fix(9, 20), 'Weltkindertag', ['TH']);
    add(fix(10, 3), 'Tag der Deutschen Einheit');
    add(fix(10, 31), 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']);
    add(fix(11, 1), 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']);
    const repentance = fix(11, 22); // Buß- und Bettag: Mittwoch vor dem 23. November
    while (repentance.getDay() !== 3) repentance.setDate(repentance.getDate() - 1);
    add(repentance, 'Buß- und Bettag', ['SN']);
    add(fix(12, 25), '1. Weihnachtstag');
    add(fix(12, 26), '2. Weihnachtstag');

    holidayCache.set(ck, map);
    return map;
  }
  const holidayName = (k, state) => holidays(Number(k.slice(0, 4)), state).get(k) || null;

  /* ---------- Daten ---------- */

  const DEFAULTS = Object.freeze({
    startDate: '2026-10-01',
    // Soll (reine Arbeitszeit) und Pause in Minuten je Wochentag, Index 0 = Sonntag
    schedule: [0, 240, 480, 0, 480, 0, 0],
    breaks: [0, 0, 30, 0, 30, 0, 0],
    dayStart: '08:00',
    vacationPerMonth: 1.5,
    vacationCredit: true, // Urlaubstag schreibt das Tages-Soll als Überstunden gut
    state: 'HB',
    initialOvertime: 0,
    vacationAdjust: {}, // { "2027": 2 } – Übertrag/Korrektur je Jahr
  });

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function normalize(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const s = Object.assign({}, DEFAULTS, src.settings && typeof src.settings === 'object' ? src.settings : {});
    const week = (a, def) =>
      Array.isArray(a) && a.length === 7 ? a.map((v) => Math.max(0, Math.round(Number(v) || 0))) : def.slice();
    s.schedule = week(s.schedule, DEFAULTS.schedule);
    s.breaks = week(s.breaks, DEFAULTS.breaks);
    s.vacationAdjust = Object.assign({}, s.vacationAdjust);
    s.vacationPerMonth = Math.max(0, Number(s.vacationPerMonth) || 0);
    s.initialOvertime = Math.round(Number(s.initialOvertime) || 0);
    s.vacationCredit = s.vacationCredit !== false;
    if (!DATE_RE.test(s.startDate)) s.startDate = DEFAULTS.startDate;
    if (!/^\d{2}:\d{2}$/.test(s.dayStart)) s.dayStart = DEFAULTS.dayStart;
    if (!(s.state in STATES)) s.state = DEFAULTS.state;

    const days = {};
    if (src.days && typeof src.days === 'object') {
      for (const [k, v] of Object.entries(src.days)) {
        if (DATE_RE.test(k) && v && typeof v === 'object') days[k] = v;
      }
    }
    return { version: 1, settings: s, days };
  }

  function workedMinutes(w) {
    if (!w) return 0;
    if (w.mode === 'duration') return Math.max(0, Math.round(Number(w.minutes) || 0));
    return Math.max(0, toMin(w.end) - toMin(w.start) - (Number(w.pause) || 0));
  }

  /* ---------- Tagesrechnung ----------
     gained: Arbeit über Soll (Unterschreitung wird NIE abgezogen)
     credit: Urlaubsgutschrift (Tages-Soll)
     used:   per "Überstunden anrechnen" verbrauchte Zeit = fehlende Soll-Zeit */
  function dayInfo(data, k) {
    const s = data.settings;
    const date = parseKey(k);
    const weekday = date.getDay();
    const beforeStart = k < s.startDate;
    const holiday = beforeStart ? null : holidayName(k, s.state);
    const scheduled = beforeStart ? 0 : s.schedule[weekday] || 0;
    const target = holiday ? 0 : scheduled;
    const pause = target > 0 ? s.breaks[weekday] || 0 : 0;
    const entry = (!beforeStart && data.days[k]) || {};
    const hasWork = !!entry.work;
    const worked = hasWork ? workedMinutes(entry.work) : 0;
    const vacation = !!entry.vacation && target > 0;
    const overtime = !vacation && !!entry.overtime && target > 0;
    const gained = vacation ? 0 : Math.max(0, worked - target);
    const credit = vacation && s.vacationCredit ? target : 0;
    const used = overtime ? Math.max(0, target - worked) : 0;
    return {
      key: k, date, weekday, beforeStart, holiday, scheduled, target, pause,
      presence: target + pause, entry, hasWork, worked, vacation, overtime,
      gained, credit, used, delta: gained + credit - used,
    };
  }

  function defaultWork(data, k) {
    const i = dayInfo(data, k);
    const start = data.settings.dayStart;
    const minutes = i.target || 240;
    return { mode: 'range', start, end: toHHMM(toMin(start) + minutes + i.pause), pause: i.pause };
  }

  /* ---------- Auswertungen ---------- */

  // Saldo inkl. Startsaldo. opts.until: bis einschließlich Datum, opts.before: vor Datum
  function balance(data, opts = {}) {
    let total = data.settings.initialOvertime || 0;
    for (const k in data.days) {
      if (opts.until && k > opts.until) continue;
      if (opts.before && k >= opts.before) continue;
      total += dayInfo(data, k).delta;
    }
    return total;
  }

  function rangeSummary(data, fromKey, toKey) {
    const r = { target: 0, worked: 0, gained: 0, credit: 0, used: 0, delta: 0, workdays: 0, vacationDays: 0 };
    for (let d = parseKey(fromKey); keyOf(d) <= toKey; d = addDays(d, 1)) {
      const i = dayInfo(data, keyOf(d));
      r.target += i.target;
      if (i.target > 0) r.workdays++;
      if (i.vacation) r.vacationDays++;
      else r.worked += i.worked;
      r.gained += i.gained;
      r.credit += i.credit;
      r.used += i.used;
      r.delta += i.delta;
    }
    return r;
  }

  function yearSummary(data, y) {
    const from = `${y}-01-01`, to = `${y}-12-31`;
    const carry = balance(data, { before: from });
    const months = Array.from({ length: 12 }, () => ({ gained: 0, credit: 0, used: 0 }));
    const bookings = [];
    let gained = 0, credit = 0, used = 0;
    for (const k of Object.keys(data.days).sort()) {
      if (k < from || k > to) continue;
      const i = dayInfo(data, k);
      if (!i.gained && !i.credit && !i.used) continue;
      const m = months[i.date.getMonth()];
      m.gained += i.gained;
      m.credit += i.credit;
      m.used += i.used;
      gained += i.gained;
      credit += i.credit;
      used += i.used;
      bookings.push(i);
    }
    return { year: y, carry, gained, credit, used, end: carry + gained + credit - used, months, bookings };
  }

  // Anspruch = volle Beschäftigungsmonate × Tage/Monat; Bruchteile ab 0,5 werden aufgerundet (§ 5 BUrlG)
  function vacationEntitlement(s, y) {
    const st = parseKey(s.startDate);
    let fy = st.getFullYear(), fm = st.getMonth();
    if (st.getDate() !== 1) { // angebrochener Startmonat zählt nicht
      fm++;
      if (fm > 11) { fm = 0; fy++; }
    }
    const months = y > fy ? 12 : y === fy ? 12 - fm : 0;
    const raw = Math.round(months * s.vacationPerMonth * 100) / 100;
    const days = Math.floor(raw + 0.5 + 1e-9);
    return { months, raw, days };
  }

  function vacationSummary(data, y, todayKey) {
    const ent = vacationEntitlement(data.settings, y);
    const adjust = Number(data.settings.vacationAdjust[y]) || 0;
    const entries = [];
    for (const k of Object.keys(data.days).sort()) {
      if (!k.startsWith(`${y}-`)) continue;
      const i = dayInfo(data, k);
      if (i.vacation) entries.push(i);
    }
    const taken = entries.filter((i) => i.key <= todayKey).length;
    const total = ent.days + adjust;
    return {
      months: ent.months, raw: ent.raw, entitled: ent.days, adjust, total, taken,
      planned: entries.length - taken, used: entries.length, remaining: total - entries.length, entries,
    };
  }

  function workdaysInRange(data, fromKey, toKey) {
    const out = [];
    let guard = 0;
    for (let d = parseKey(fromKey); keyOf(d) <= toKey && guard < 800; d = addDays(d, 1), guard++) {
      const k = keyOf(d);
      if (dayInfo(data, k).target > 0) out.push(k);
    }
    return out;
  }

  /* ---------- Änderungen ---------- */

  function patchDay(data, k, fn) {
    const e = Object.assign({}, data.days[k]);
    fn(e);
    for (const p of Object.keys(e)) if (e[p] === undefined || e[p] === null || e[p] === false) delete e[p];
    if (Object.keys(e).length) data.days[k] = e;
    else delete data.days[k];
  }
  // Arbeitszeit bleibt beim Urlaub gespeichert und gilt wieder, sobald der Urlaub entfernt wird
  const setWork = (data, k, work) => patchDay(data, k, (e) => { e.work = work || undefined; });
  const setVacation = (data, k, on) => patchDay(data, k, (e) => { e.vacation = !!on; if (on) e.overtime = false; });
  const setOvertime = (data, k, on) => patchDay(data, k, (e) => { e.overtime = !!on; if (on) e.vacation = false; });

  return {
    pad, keyOf, parseKey, addDays, addMonths, daysInMonth, startOfWeek, isoWeek,
    WD_SHORT, WD_LONG, MONTHS, MONTHS_SHORT,
    toMin, toHHMM, fmt, fmtShort, num, parseHM,
    STATES, easterSunday, holidays, holidayName,
    DEFAULTS, normalize, workedMinutes, dayInfo, defaultWork,
    balance, rangeSummary, yearSummary, vacationEntitlement, vacationSummary, workdaysInRange,
    setWork, setVacation, setOvertime,
  };
});
