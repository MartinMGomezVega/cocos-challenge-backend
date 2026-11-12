import { Module } from '@nestjs/common';
import { InstrumentsModule } from './composition/instruments.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule, InstrumentsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
