import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '../../common/constants/roles.constant';
import { ApiEnvelope, ApiPaginatedEnvelope } from '../../common/decorators/api-envelope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateEmployeeDto,
  EmployeeDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employees')
@ApiBearerAuth('access-token')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @Roles(RoleName.ADMIN, RoleName.HR, RoleName.MANAGER)
  @ApiOperation({ summary: 'List employees (managers only see their team)' })
  @ApiPaginatedEnvelope(EmployeeDto)
  findAll(@Query() query: EmployeeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.findAll(query, user);
  }

  // NOTE: declared before ':id' so "me" is not parsed as a UUID.
  @Get('me')
  @ApiOperation({ summary: 'Employee profile of the signed-in user' })
  @ApiEnvelope(EmployeeDto)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.employees.findMe(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee (self, manager of the employee, HR, admin)' })
  @ApiEnvelope(EmployeeDto)
  findOne(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.findOne(id, user);
  }

  @Get(':id/reportees')
  @ApiOperation({ summary: 'Direct reportees of an employee' })
  reportees(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.reportees(id, user);
  }

  @Post()
  @Roles(RoleName.ADMIN, RoleName.HR)
  @ApiOperation({ summary: 'Create an employee' })
  @ApiEnvelope(EmployeeDto, 'created')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN, RoleName.HR)
  @ApiOperation({ summary: 'Update an employee' })
  @ApiEnvelope(EmployeeDto)
  update(@Param() { id }: IdParamDto, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.ADMIN, RoleName.HR)
  @ApiOperation({ summary: 'Deactivate an employee (soft delete) and disable their login' })
  remove(@Param() { id }: IdParamDto) {
    return this.employees.deactivate(id);
  }

  @Post(':id/profile-image')
  @Roles(RoleName.ADMIN, RoleName.HR)
  @ApiOperation({ summary: 'Upload the profile picture (JPEG/PNG/WebP, max 2 MB) to Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  uploadImage(@Param() { id }: IdParamDto, @UploadedFile() file?: Express.Multer.File) {
    return this.employees.uploadProfileImage(id, file);
  }

  @Get(':id/profile-image')
  @ApiOperation({ summary: 'Temporary signed URL for the profile picture' })
  profileImage(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.profileImageUrl(id, user);
  }
}
