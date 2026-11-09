import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '../../common/constants/roles.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto, MonthlyAttendanceQueryDto, UpsertAttendanceDto } from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('punch-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Punch in for today' })
  punchIn(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.punchIn(user);
  }

  @Post('punch-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Punch out; worked minutes are computed and half-days detected from the shift' })
  punchOut(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.punchOut(user);
  }

  @Get('today')
  @ApiOperation({ summary: "Today's attendance record of the signed-in employee" })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.today(user);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Month calendar + summary (holidays, leaves, weekends derived)' })
  monthly(@Query() query: MonthlyAttendanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.monthly(query, user);
  }

  @Get()
  @ApiOperation({ summary: 'List attendance records (own / team / all depending on role)' })
  findAll(@Query() query: AttendanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.findAll(query, user);
  }

  @Put()
  @Roles(RoleName.ADMIN, RoleName.HR)
  @ApiOperation({ summary: 'HR/Admin: create or correct an attendance record for an employee/day' })
  upsert(@Body() dto: UpsertAttendanceDto) {
    return this.attendance.upsert(dto);
  }
}
