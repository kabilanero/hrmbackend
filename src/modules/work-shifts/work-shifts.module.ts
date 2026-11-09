import { Module } from '@nestjs/common';
import { WorkShiftsController } from './work-shifts.controller';
import { WorkShiftsService } from './work-shifts.service';

@Module({
  controllers: [WorkShiftsController],
  providers: [WorkShiftsService],
  exports: [WorkShiftsService],
})
export class WorkShiftsModule {}
