import { BadRequestException } from '@nestjs/common';

/**
 * Converts "field:asc" / "a.b:desc" into a Prisma orderBy object.
 * Only fields in `allowed` can be sorted on (prevents probing of arbitrary columns).
 */
export function parseSort(
  sort: string | undefined,
  allowed: string[],
  fallback: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
): Record<string, any> {
  if (!sort) return fallback;
  const [path, dir = 'asc'] = sort.split(':');
  if (!allowed.includes(path)) {
    throw new BadRequestException(`Cannot sort by "${path}". Allowed: ${allowed.join(', ')}`);
  }
  return path
    .split('.')
    .reverse()
    .reduce<any>((acc, key) => ({ [key]: acc }), dir);
}

/** Builds a case-insensitive OR "contains" filter over the given fields. */
export function buildSearch(search: string | undefined, fields: string[]) {
  const term = search?.trim();
  if (!term || !fields.length) return undefined;
  return {
    OR: fields.map((f) =>
      f
        .split('.')
        .reverse()
        .reduce<any>((acc, key) => ({ [key]: acc }), { contains: term, mode: 'insensitive' }),
    ),
  };
}
