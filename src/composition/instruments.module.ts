import { Module } from '@nestjs/common';
import {
  INSTRUMENT_REPOSITORY,
  InstrumentRepository,
} from '../application/ports/instrument.repository';
import { SearchInstrumentsUseCase } from '../application/use-cases/search-instruments.use-case';
import { TypeOrmInstrumentRepository } from '../infrastructure/repositories/typeorm-instrument.repository';
import { InstrumentsController } from '../presentation/controllers/instruments.controller';

@Module({
  controllers: [InstrumentsController],
  providers: [
    {
      provide: INSTRUMENT_REPOSITORY,
      useClass: TypeOrmInstrumentRepository,
    },
    {
      provide: SearchInstrumentsUseCase,
      inject: [INSTRUMENT_REPOSITORY],
      useFactory: (instrumentRepository: InstrumentRepository) =>
        new SearchInstrumentsUseCase(instrumentRepository),
    },
  ],
})
export class InstrumentsModule {}
