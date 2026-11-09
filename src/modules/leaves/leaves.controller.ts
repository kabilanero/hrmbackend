import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleName } from '../../common/constants/roles.constant';
import { ApiPaginatedEnvelope } from '../../common/decorators/api-envelope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyLeaveDto, LeaveBalanceQueryDto, LeaveDecisionDto, LeaveQueryDto } from './dto/leave.dto';
import { LeavesService } from './leaves.service';

class LeaveListDoc {}

@ApiTags('Leaves')
@ApiBearerAuth('access-token')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post()
  @ApiOperation({
    summary: 'Apply for leave',
    description:
      'Working days exclude Saturdays, Sundays and active national holidays. Rejects overlapping pending/approved leaves and requests above the yearly entitlement.',
  })
  apply(@Body() dto: ApplyLeaveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.apply(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List leave applications (own / team / all depending on role)' })
  @ApiPaginatedEnvelope(LeaveListDoc)
  findAll(@Query() query: LeaveQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.findAll(query, user);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Leave balance per leave type for a year' })
  balance(@Query() query: LeaveBalanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.balance(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a leave application' })
  findOne(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.findOne(id, user);
  }

  @Patch(':id/decision')
  @Roles(RoleName.ADMIN, RoleName.HR, RoleName.MANAGER)
  @ApiOperation({ summary: 'Approve or reject a pending leave' })
  decide(@Param() { id }: IdParamDto, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.decide(id, dto, user);
  }

  @Patch(':id/revoke')
  @Roles(RoleName.ADMIN, RoleName.HR, RoleName.MANAGER)
  @ApiOperation({ summary: 'Revoke an approved leave' })
  revoke(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.revoke(id, undefined, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel your own pending leave' })
  cancel(@Param() { id }: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaves.cancel(id, user);
  }
}
