import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Caller, CurrentCaller } from '../auth/caller';
import { parseCoordinate, parseLayerList } from '../common/geo';
import { config } from '../config';
import { FeaturesService } from './features.service';

@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get('at')
  at(
    @Query('lon') rawLon: string | undefined,
    @Query('lat') rawLat: string | undefined,
    @Query('layers') rawLayers: string | undefined,
    @CurrentCaller() caller: Caller,
  ) {
    const lon = parseCoordinate(rawLon, 180);
    const lat = parseCoordinate(rawLat, 90);
    if (lon === undefined || lat === undefined) throw new BadRequestException('lon and lat are required');
    return this.features.at(lon, lat, parseLayerList(rawLayers, config.defaultClickLayers), caller);
  }
}
