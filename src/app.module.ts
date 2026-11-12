import { Module } from '@nestjs/common';
import { InstrumentsModule } from './composition/instruments.module';
import { PortfolioModule } from './composition/portfolio.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule, InstrumentsModule, PortfolioModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
