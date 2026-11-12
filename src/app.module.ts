import { Module } from '@nestjs/common';
import { InstrumentsModule } from './composition/instruments.module';
import { OrdersModule } from './composition/orders.module';
import { PortfolioModule } from './composition/portfolio.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule, InstrumentsModule, PortfolioModule, OrdersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
