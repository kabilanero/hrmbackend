import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '../constants/roles.constant';
import { Roles } from '../decorators/roles.decorator';
import {
  ApiEnvelope,
  ApiEnvelopeArray,
  ApiPaginatedEnvelope,
} from '../decorators/api-envelope.decorator';
import { IdParamDto } from '../dto/id-param.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { BaseCrudService } from './base-crud.service';

export interface CrudControllerOptions {
  /** Route segment, e.g. "departments" -> /api/v1/departments */
  path: string;
  tag: string;
  /** Singular label for Swagger summaries. */
  label: string;
  createDto: Type<unknown>;
  updateDto: Type<unknown>;
  responseDto: Type<unknown>;
  /** Roles allowed to create/update/delete. Reads are open to any authenticated user. */
  writeRoles?: RoleName[];
}

/**
 * Builds a fully documented CRUD controller (list, dropdown list, get, create,
 * update, delete) so simple master-data resources need no boilerplate.
 * The concrete class only has to inject its service:
 *
 *   @Controller() export class DepartmentsController extends createCrudController({...}) {
 *     constructor(service: DepartmentsService) { super(service); }
 *   }
 */
export function createCrudController(opts: CrudControllerOptions) {
  const writeRoles = opts.writeRoles ?? [RoleName.ADMIN, RoleName.HR];
  const bodyPipe = (dto: Type<unknown>) =>
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, expectedType: dto });

  @ApiTags(opts.tag)
  @ApiBearerAuth('access-token')
  @Controller(opts.path)
  class CrudController {
    constructor(readonly service: BaseCrudService) {}

    @Get()
    @ApiOperation({ summary: `List ${opts.label} records (paginated, searchable, sortable)` })
    @ApiPaginatedEnvelope(opts.responseDto)
    findAll(@Query() query: PaginationQueryDto) {
      return this.service.findAll(query);
    }

    @Get('all')
    @ApiOperation({ summary: `All ${opts.label} records without pagination (dropdowns)` })
    @ApiEnvelopeArray(opts.responseDto)
    findAllList() {
      return this.service.findAllList();
    }

    @Get(':id')
    @ApiOperation({ summary: `Get a ${opts.label} by id` })
    @ApiEnvelope(opts.responseDto)
    findOne(@Param() { id }: IdParamDto) {
      return this.service.findOne(id);
    }

    @Post()
    @Roles(...writeRoles)
    @ApiOperation({ summary: `Create a ${opts.label}` })
    @ApiBody({ type: opts.createDto })
    @ApiEnvelope(opts.responseDto, 'created')
    create(@Body(bodyPipe(opts.createDto)) dto: any) {
      return this.service.create(dto);
    }

    @Patch(':id')
    @Roles(...writeRoles)
    @ApiOperation({ summary: `Update a ${opts.label}` })
    @ApiBody({ type: opts.updateDto })
    @ApiEnvelope(opts.responseDto)
    update(@Param() { id }: IdParamDto, @Body(bodyPipe(opts.updateDto)) dto: any) {
      return this.service.update(id, dto);
    }

    @Delete(':id')
    @Roles(...writeRoles)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: `Delete a ${opts.label}` })
    remove(@Param() { id }: IdParamDto) {
      return this.service.remove(id);
    }
  }

  return CrudController;
}
