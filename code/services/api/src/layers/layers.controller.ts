import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Caller, CurrentCaller } from '../auth/caller';
import { parseBbox } from '../common/geo';
import { LayersService } from './layers.service';

const DEFAULT_TOLERANCE = 0.0005;
const MAX_TOLERANCE = 0.05;

@Controller('layers')
export class LayersController {
  constructor(private readonly layers: LayersService) {}

  @Get()
  list(@CurrentCaller() caller: Caller) {
    return this.layers.listVisible(caller);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string, @CurrentCaller() caller: Caller) {
    return this.layers.summary(id, caller);
  }

  @Get(':id/geojson')
  geojson(
    @Param('id') id: string,
    @Query('bbox') rawBbox: string | undefined,
    @Query('simplify') rawSimplify: string | undefined,
    @CurrentCaller() caller: Caller,
  ) {
    const bbox = parseBbox(rawBbox);
    if (!bbox) throw new BadRequestException('bbox=minLon,minLat,maxLon,maxLat is required');
    const tolerance = rawSimplify === undefined ? DEFAULT_TOLERANCE : Number(rawSimplify);
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > MAX_TOLERANCE) {
      throw new BadRequestException(`simplify must be between 0 and ${MAX_TOLERANCE}`);
    }
    return this.layers.exportGeoJson(id, caller, bbox, tolerance);
  }
}
