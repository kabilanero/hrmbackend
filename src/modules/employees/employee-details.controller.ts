import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EmployeeDetailsService } from './employee-details.service';
import {
  CreateBankAccountDto,
  CreateEmployeeAddressDto,
  EmployeeIdParamDto,
  EmployeeSubIdParamDto,
  UpdateBankAccountDto,
  UpdateEmployeeAddressDto,
} from './dto/employee.dto';

@ApiTags('Employee addresses')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/addresses')
export class EmployeeAddressesController {
  constructor(private readonly details: EmployeeDetailsService) {}

  @Get()
  @ApiOperation({ summary: 'List addresses of an employee' })
  list(@Param() { employeeId }: EmployeeIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.details.listAddresses(employeeId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Add an address (self or HR)' })
  create(
    @Param() { employeeId }: EmployeeIdParamDto,
    @Body() dto: CreateEmployeeAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.details.createAddress(employeeId, dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address (self or HR)' })
  update(
    @Param() { employeeId, id }: EmployeeSubIdParamDto,
    @Body() dto: UpdateEmployeeAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.details.updateAddress(employeeId, id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an address (self or HR)' })
  remove(@Param() { employeeId, id }: EmployeeSubIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.details.removeAddress(employeeId, id, user);
  }
}

@ApiTags('Employee bank accounts')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/bank-accounts')
export class EmployeeBankAccountsController {
  constructor(private readonly details: EmployeeDetailsService) {}

  @Get()
  @ApiOperation({ summary: 'List bank accounts (self or HR only)' })
  list(@Param() { employeeId }: EmployeeIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.details.listBankAccounts(employeeId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Add a bank account; setting isPrimary demotes the others' })
  create(
    @Param() { employeeId }: EmployeeIdParamDto,
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.details.createBankAccount(employeeId, dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bank account' })
  update(
    @Param() { employeeId, id }: EmployeeSubIdParamDto,
    @Body() dto: UpdateBankAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.details.updateBankAccount(employeeId, id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a bank account' })
  remove(@Param() { employeeId, id }: EmployeeSubIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.details.removeBankAccount(employeeId, id, user);
  }
}
