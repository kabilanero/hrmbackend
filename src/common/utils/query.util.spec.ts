import { BadRequestException } from '@nestjs/common';
import { eachDay, monthRange, todayInTz, toDateOnly } from './date.util';
import { Paginated } from './paginated';
import { buildSearch, parseSort } from './query.util';

describe('query.util', () => {
  it('parses sort and rejects fields outside the whitelist', () => {
    expect(parseSort('name:desc', ['name'])).toEqual({ name: 'desc' });
    expect(parseSort('department.name', ['department.name'])).toEqual({ department: { name: 'asc' } });
    expect(parseSort(undefined, ['name'], { name: 'asc' })).toEqual({ name: 'asc' });
    expect(() => parseSort('password:asc', ['name'])).toThrow(BadRequestException);
  });

  it('builds a case-insensitive OR search incl. relation fields', () => {
    expect(buildSearch('  ', ['name'])).toBeUndefined();
    expect(buildSearch('ab', ['name', 'department.name'])).toEqual({
      OR: [
        { name: { contains: 'ab', mode: 'insensitive' } },
        { department: { name: { contains: 'ab', mode: 'insensitive' } } },
      ],
    });
  });
});

describe('paginated', () => {
  it('computes page metadata', () => {
    const p = Paginated.of([1, 2], 45, 2, 20);
    expect(p.meta).toEqual({ page: 2, size: 20, totalItems: 45, totalPages: 3, hasNext: true, hasPrevious: true });
    expect(Paginated.of([], 0, 1, 20).meta.totalPages).toBe(1);
  });
});

describe('date.util', () => {
  it('resolves "today" in the configured timezone, not UTC', () => {
    // 2026-11-07T20:00Z is already 2026-11-08 in Kolkata (UTC+5:30)
    const now = new Date('2026-11-07T20:00:00Z');
    expect(todayInTz('Asia/Kolkata', now).toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(todayInTz('UTC', now).toISOString()).toBe('2026-11-07T00:00:00.000Z');
  });

  it('iterates days and month ranges', () => {
    expect([...eachDay(toDateOnly('2026-02-27'), toDateOnly('2026-03-02'))]).toHaveLength(4);
    const { from, to } = monthRange(2028, 2);
    expect(from.toISOString().slice(0, 10)).toBe('2028-02-01');
    expect(to.toISOString().slice(0, 10)).toBe('2028-02-29');
  });
});
