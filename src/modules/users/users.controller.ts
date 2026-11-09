import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '../../common/constants/roles.constant';
import { ApiEnvelope, ApiPaginatedEnvelope } from '../../common/decorators/api-envelope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto, UpdateUserDto, UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Roles(RoleName.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List login accounts' })
  @ApiPaginatedEnvelope(UserDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.users.findAll(query);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List available roles' })
  @Roles(RoleName.ADMIN, RoleName.HR)
  roles() {
    return this.users.listRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a login account' })
  @ApiEnvelope(UserDto)
  findOne(@Param() { id }: IdParamDto) {
    return this.users.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a login (Supabase user + app profile) with any role' })
  @ApiEnvelope(UserDto, 'created')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change role, activation or employee link' })
  @ApiEnvelope(UserDto)
  update(@Param() { id }: IdParamDto, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a login (Supabase + app profile)' })
  remove(@Param() { id }: IdParamDto, @CurrentUser('id') actingUserId: string) {
    return this.users.remove(id, actingUserId);
  }
}
