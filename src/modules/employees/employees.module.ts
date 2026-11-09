import { Module } from '@nestjs/common';
import { EmployeeAccessService } from './employee-access.service';
import { EmployeeAddressesController, EmployeeBankAccountsController } from './employee-details.controller';
import { EmployeeDetailsService } from './employee-details.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController, EmployeeAddressesController, EmployeeBankAccountsController],
  providers: [EmployeesService, EmployeeDetailsService, EmployeeAccessService],
  exports: [EmployeesService, EmployeeAccessService],
})
export class EmployeesModule {}
