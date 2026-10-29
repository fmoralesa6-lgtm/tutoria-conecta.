import test from "node:test";
import assert from "node:assert/strict";
import { recurring, fits, kmBetween } from "./rules.js";
test("4 semanas con lunes y miércoles crean 8 sesiones en Guatemala", () => {
  const s = recurring("2026-10-19", 4, [1, 3], 540, 90);
  assert.equal(s.length, 8);
  assert.equal(s[0].start, "2026-10-19T15:00:00.000Z");
  assert.equal(s[0].end, "2026-10-19T16:30:00.000Z");
});
test("8 semanas atraviesan año sin cambiar hora local", () => {
  const s = recurring("2026-12-28", 8, [1], 540, 60);
  assert.equal(s.length, 8);
  assert.equal(s[7].start, "2027-02-15T15:00:00.000Z");
});
test("1 semana con los siete días crea siete sesiones diarias", () => {
  const s = recurring("2026-10-26", 1, [0, 1, 2, 3, 4, 5, 6], 540, 60);
  assert.equal(s.length, 7);
  assert.equal(s[0].start, "2026-10-26T15:00:00.000Z");
  assert.equal(s[6].start, "2026-11-01T15:00:00.000Z");
});
test("la sesión completa debe caber en la disponibilidad", () => {
  const b = [{ weekday: 1, start_min: 540, end_min: 660 }];
  assert(fits(b, 1, 540, 120));
  assert(!fits(b, 1, 600, 90));
  assert(!fits(b, 2, 540, 60));
});
test("radio geográfico diferencia cercanía de ruta vial", () => {
  assert.equal(kmBetween({ lat: 14, lng: -90 }, { lat: 14, lng: -90 }), 0);
  assert(kmBetween({ lat: 14, lng: -90 }, { lat: 15, lng: -90 }) > 110);
});