import { NotFoundException } from '@nestjs/common';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { Paginated } from '../utils/paginated';
import { buildSearch, parseSort } from '../utils/query.util';

/** Minimal surface of a Prisma model delegate that the base service relies on. */
export interface CrudDelegate {
  findMany(args?: any): Promise<any[]>;
  count(args?: any): Promise<number>;
  findUnique(args: any): Promise<any>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
}

export interface CrudOptions {
  /** Human readable name used in error messages. */
  entityName: string;
  /** Fields matched by the free-text `search` param (supports "relation.field"). */
  searchFields: string[];
  /** Fields clients may sort by. */
  sortableFields: string[];
  defaultSort?: Record<string, 'asc' | 'desc'>;
  include?: Record<string, unknown>;
}

/**
 * Reusable data-access + pagination logic. Feature services extend this and
 * override hooks (e.g. `beforeCreate`) only when they have real business rules.
 */
export abstract class BaseCrudService<C = any, U = any> {
  protected constructor(
    protected readonly delegate: CrudDelegate,
    protected readonly options: CrudOptions,
  ) {}

  /** Extra filters merged into list queries (override in subclasses). */
  protected extraWhere(_query: PaginationQueryDto): Record<string, unknown> {
    return {};
  }

  async findAll(query: PaginationQueryDto) {
    const where = {
      ...this.extraWhere(query),
      ...(buildSearch(query.search, this.options.searchFields) ?? {}),
    };
    const orderBy = parseSort(query.sort, this.options.sortableFields, this.options.defaultSort);
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.size,
        take: query.size,
        include: this.options.include,
      }),
      this.delegate.count({ where }),
    ]);
    return Paginated.of(items, total, query.page, query.size);
  }

  /** Unpaginated list, intended for dropdowns. */
  findAllList() {
    return this.delegate.findMany({
      orderBy: this.options.defaultSort ?? { createdAt: 'desc' },
      include: this.options.include,
    });
  }

  async findOne(id: string) {
    const row = await this.delegate.findUnique({ where: { id }, include: this.options.include });
    if (!row) throw new NotFoundException(`${this.options.entityName} not found`);
    return row;
  }

  create(dto: C) {
    return this.delegate.create({ data: dto as any, include: this.options.include });
  }

  async update(id: string, dto: U) {
    await this.findOne(id);
    return this.delegate.update({ where: { id }, data: dto as any, include: this.options.include });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.delegate.delete({ where: { id } });
    return { id, deleted: true };
  }
}
