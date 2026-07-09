// Local date, not UTC: toISOString() converts to UTC first, which rolls
// over to "tomorrow" every evening for anyone west of UTC (i.e. most of
// the US) while it's still today on their clock.
export function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Everything below treats a YYYY-MM-DD string as UTC midnight purely as a
// calendar-arithmetic trick (no timezone is actually involved) - it keeps
// add/subtract and day-of-week free of DST-related off-by-one bugs.
function parseUTC(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

export function addDays(dateStr, days) {
  const d = parseUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(dateStr) {
  return addDays(dateStr, -parseUTC(dateStr).getUTCDay());
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function dayOfWeekLabel(dateStr) {
  return DOW_LABELS[parseUTC(dateStr).getUTCDay()];
}

export function dayNum(dateStr) {
  return Number(dateStr.slice(8, 10));
}

export function formatShortDate(dateStr) {
  const d = parseUTC(dateStr);
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
