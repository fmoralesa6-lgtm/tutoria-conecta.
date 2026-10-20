export interface Block {
  weekday: number;
  start_min: number;
  end_min: number;
}
export function recurring(
  startDate: string,
  weeks: number,
  days: number[],
  minute: number,
  duration: number,
) {
  const base = new Date(startDate + "T00:00:00-06:00");
  const out: { start: string; end: string; weekday: number; minute: number }[] =
    [];
  for (let n = 0; n < weeks * 7; n++) {
    const d = new Date(base.getTime() + n * 86400000);
    const weekday = new Date(d.getTime() - 21600000).getUTCDay();
    if (days.includes(weekday)) {
      const start = new Date(d.getTime() + minute * 60000);
      out.push({
        start: start.toISOString(),
        end: new Date(start.getTime() + duration * 60000).toISOString(),
        weekday,
        minute,
      });
    }
  }
  return out;
}
export function fits(
  blocks: Block[],
  day: number,
  start: number,
  duration: number,
) {
  return blocks.some(
    (b) =>
      b.weekday === day &&
      b.start_min <= start &&
      b.end_min >= start + duration,
  );
}
export function kmBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
