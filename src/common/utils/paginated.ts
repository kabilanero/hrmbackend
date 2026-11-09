export interface PageMeta {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Marker class so the response interceptor can recognise paginated payloads. */
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}

  static of<T>(items: T[], totalItems: number, page: number, size: number): Paginated<T> {
    const totalPages = Math.max(1, Math.ceil(totalItems / size));
    return new Paginated(items, {
      page,
      size,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    });
  }
}
