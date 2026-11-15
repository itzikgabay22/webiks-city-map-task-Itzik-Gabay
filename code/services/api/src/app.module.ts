import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AuthController } from './auth/auth.controller';
import { CallerMiddleware } from './auth/caller';
import { FeaturesController } from './features/features.controller';
import { FeaturesService } from './features/features.service';
import { HealthController } from './health/health.controller';
import { InfraModule } from './infra/infra.module';
import { LayersController } from './layers/layers.controller';
import { LayersService } from './layers/layers.service';
import { PartnerController, PartnerKeyGuard } from './partner/partner.controller';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';

@Module({
  imports: [InfraModule],
  controllers: [
    HealthController,
    AuthController,
    LayersController,
    FeaturesController,
    SearchController,
    PartnerController,
    AnnouncementsController,
  ],
  providers: [LayersService, FeaturesService, SearchService, PartnerKeyGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CallerMiddleware).forRoutes('*path');
  }
}
