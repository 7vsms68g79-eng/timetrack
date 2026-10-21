// Ausführen: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/core.js');

const fresh = () => T.normalize(null);
const range = (start, end, pause = 0) => ({ mode: 'range', start, end, pause });

test('Wochenplan: Mo 4 h, Di 8 h, Do 8 h = 20 h, Pausen 30 min an Di/Do', () => {
  const d = fresh();
  // KW 43/2026: Mo 19.10. – So 25.10.
  const week = T.rangeSummary(d, '2026-10-19', '2026-10-25');
  assert.equal(week.target, 20 * 60);
  assert.equal(week.workdays, 3);
  assert.equal(T.dayInfo(d, '2026-10-19').target, 240);
  assert.equal(T.dayInfo(d, '2026-10-20').presence, 510); // 8:30 vor Ort
  assert.equal(T.dayInfo(d, '2026-10-21').target, 0); // Mittwoch frei
  assert.equal(T.dayInfo(d, '2026-10-22').presence, 510);
});

test('Tage vor dem Arbeitsbeginn haben kein Soll und zählen nicht', () => {
  const d = fresh();
  assert.equal(T.dayInfo(d, '2026-09-29').target, 0);
  d.days['2026-09-29'] = { work: range('08:00', '18:00') };
  assert.equal(T.balance(d), 0);
});

test('Mehrarbeit wird gutgeschrieben, Unterschreitung nie abgezogen', () => {
  const d = fresh();
  T.setWork(d, '2026-10-20', range('08:00', '17:30', 30)); // 9:00 netto
  assert.equal(T.dayInfo(d, '2026-10-20').delta, 60);
  T.setWork(d, '2026-10-19', range('08:00', '11:00')); // 3 h statt 4 h
  assert.equal(T.dayInfo(d, '2026-10-19').delta, 0);
  assert.equal(T.balance(d), 60);
});

test('Arbeit an freien Tagen zählt komplett als Überstunden', () => {
  const d = fresh();
  T.setWork(d, '2026-10-21', { mode: 'duration', minutes: 150 });
  assert.equal(T.balance(d), 150);
});

test('Urlaub schreibt das Tages-Soll als Überstunden gut (Mo +4 h, Di +8 h)', () => {
  const d = fresh();
  T.setVacation(d, '2026-10-26', true); // Montag
  assert.equal(T.dayInfo(d, '2026-10-26').credit, 240);
  T.setVacation(d, '2026-10-27', true); // Dienstag
  assert.equal(T.balance(d), 240 + 480);
  d.settings.vacationCredit = false;
  assert.equal(T.balance(d), 0);
});

test('Urlaub nur an Arbeitstagen, gespeicherte Arbeitszeit kommt nach dem Entfernen zurück', () => {
  const d = fresh();
  T.setVacation(d, '2026-10-21', true); // Mittwoch
  assert.equal(T.dayInfo(d, '2026-10-21').vacation, false);
  T.setWork(d, '2026-10-22', range('08:00', '17:30', 30));
  T.setVacation(d, '2026-10-22', true);
  assert.equal(T.dayInfo(d, '2026-10-22').gained, 0);
  T.setVacation(d, '2026-10-22', false);
  assert.equal(T.dayInfo(d, '2026-10-22').gained, 60);
});

test('Überstunden anrechnen: ganzer Tag = volles Soll, teilweise = nur die Lücke, rückgängig', () => {
  const d = fresh();
  T.setWork(d, '2026-10-19', { mode: 'duration', minutes: 600 }); // Mo 10 h → +6 h
  T.setOvertime(d, '2026-10-20', true); // Di frei → −8 h
  assert.equal(T.dayInfo(d, '2026-10-20').used, 480);
  assert.equal(T.balance(d), 360 - 480);
  T.setWork(d, '2026-10-20', { mode: 'duration', minutes: 360 }); // doch 6 h gearbeitet
  assert.equal(T.dayInfo(d, '2026-10-20').used, 120);
  T.setOvertime(d, '2026-10-20', false);
  assert.equal(T.balance(d), 360);
  assert.ok(!('overtime' in d.days['2026-10-20']));
});

test('Urlaubsanspruch: 2026 = 3 × 1,5 = 4,5 → 5 Tage, 2027 = 18 Tage', () => {
  const s = fresh().settings;
  assert.deepEqual(T.vacationEntitlement(s, 2026), { months: 3, raw: 4.5, days: 5 });
  assert.equal(T.vacationEntitlement(s, 2027).days, 18);
  assert.equal(T.vacationEntitlement(s, 2025).days, 0);
});

test('Resturlaub: genommen, geplant und Korrektur', () => {
  const d = fresh();
  T.setVacation(d, '2026-10-19', true);
  T.setVacation(d, '2026-12-01', true);
  d.settings.vacationAdjust[2026] = 1;
  const v = T.vacationSummary(d, 2026, '2026-10-21');
  assert.equal(v.taken, 1);
  assert.equal(v.planned, 1);
  assert.equal(v.entitled, 5);
  assert.equal(v.total, 6);
  assert.equal(v.entries.length, 2);
  assert.equal(v.remaining, 4);
});

test('Feiertage: Ostern, bundesweit und Bremen', () => {
  assert.equal(T.keyOf(T.easterSunday(2026)), '2026-04-05');
  assert.equal(T.keyOf(T.easterSunday(2027)), '2027-03-28');
  const d = fresh(); // Bremen
  assert.equal(T.dayInfo(d, '2027-03-29').holiday, 'Ostermontag');
  assert.equal(T.dayInfo(d, '2027-03-29').target, 0);
  assert.equal(T.dayInfo(d, '2027-05-06').holiday, 'Christi Himmelfahrt');
  assert.equal(T.dayInfo(d, '2027-05-06').target, 0);
  assert.equal(T.dayInfo(d, '2028-10-31').holiday, 'Reformationstag'); // Dienstag
  assert.equal(T.dayInfo(d, '2028-10-31').target, 0);
  assert.equal(T.dayInfo(d, '2026-11-18').holiday, null); // Buß- und Bettag nur Sachsen
  d.settings.state = 'SN';
  assert.equal(T.dayInfo(d, '2026-11-18').holiday, 'Buß- und Bettag');
});

test('Jahresübersicht mit Übertrag ins Folgejahr', () => {
  const d = fresh();
  T.setWork(d, '2026-12-01', { mode: 'duration', minutes: 300 }); // Di 5 h → 0
  T.setWork(d, '2026-12-03', { mode: 'duration', minutes: 540 }); // Do 9 h → +1 h
  T.setOvertime(d, '2027-01-05', true); // Di → −8 h
  const y26 = T.yearSummary(d, 2026);
  assert.equal(y26.end, 60);
  const y27 = T.yearSummary(d, 2027);
  assert.equal(y27.carry, 60);
  assert.equal(y27.used, 480);
  assert.equal(y27.end, -420);
});

test('Formatierung und Eingabe', () => {
  assert.equal(T.fmt(510), '8:30');
  assert.equal(T.fmt(30, true), '+0:30');
  assert.equal(T.fmt(-75, true), '−1:15');
  assert.equal(T.fmt(0, true), '0:00');
  assert.equal(T.fmtShort(240), '4h');
  assert.equal(T.num(4.5), '4,5');
  assert.equal(T.parseHM('3:30'), 210);
  assert.equal(T.parseHM('-1:15'), -75);
  assert.equal(T.parseHM('2,5'), 150);
  assert.ok(Number.isNaN(T.parseHM('abc')));
});
