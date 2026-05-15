import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZagaSessionGuard } from '../zaga-auth/guards/zaga-session.guard';
import { UsersListQueryDto } from './dto/users-list-query.dto';
import { UsersBackofficeService } from './users-backoffice.service';

@ApiTags('Backoffice — Users')
@ApiBearerAuth('zaga-session')
@UseGuards(ZagaSessionGuard)
@Controller('private/users')
export class UsersBackofficeController {
  public constructor(
    private readonly usersBackofficeService: UsersBackofficeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listado de usuarios' })
  public list(@Query() query: UsersListQueryDto) {
    return this.usersBackofficeService.list(query);
  }
}
