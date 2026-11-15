import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('address')
  address(@Query('q') q: string | undefined) {
    if (!q || q.trim().length < 3) throw new BadRequestException('q must be at least 3 characters');
    if (q.length > 120) throw new BadRequestException('q is too long');
    return this.search.searchAddress(q);
  }
}
