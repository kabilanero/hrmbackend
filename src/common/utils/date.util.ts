/** Returns the calendar date (YYYY-MM-DD) of `now` in the given IANA timezone. */
export function dateStringInTz(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** A DATE column value (UTC midnight) for "today" in the given timezone. */
export function todayInTz(timezone: string, now = new Date()): Date {
  return new Date(`${dateStringInTz(timezone, now)}T00:00:00.000Z`);
}

export function toDateOnly(value: string | Date): Date {
  const s = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

export function* eachDay(from: Date, to: Date): Generator<Date> {
  const d = new Date(from);
  while (d <= to) {
    yield new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

export function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  };
}
