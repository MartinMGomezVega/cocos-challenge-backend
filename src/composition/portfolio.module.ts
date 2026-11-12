import { Module } from '@nestjs/common';
import {
  INSTRUMENT_REPOSITORY,
  InstrumentRepository,
} from '../application/ports/instrument.repository';
import {
  ORDER_REPOSITORY,
  OrderRepository,
} from '../application/ports/order.repository';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../application/ports/user.repository';
import { GetPortfolioUseCase } from '../application/use-cases/get-portfolio.use-case';
import { TypeOrmInstrumentRepository } from '../infrastructure/repositories/typeorm-instrument.repository';
import { TypeOrmOrderRepository } from '../infrastructure/repositories/typeorm-order.repository';
import { TypeOrmUserRepository } from '../infrastructure/repositories/typeorm-user.repository';
import { PortfolioController } from '../presentation/controllers/portfolio.controller';

@Module({
  controllers: [PortfolioController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: INSTRUMENT_REPOSITORY,
      useClass: TypeOrmInstrumentRepository,
    },
    {
      provide: GetPortfolioUseCase,
      inject: [USER_REPOSITORY, ORDER_REPOSITORY, INSTRUMENT_REPOSITORY],
      useFactory: (
        userRepository: UserRepository,
        orderRepository: OrderRepository,
        instrumentRepository: InstrumentRepository,
      ) =>
        new GetPortfolioUseCase(
          userRepository,
          orderRepository,
          instrumentRepository,
        ),
    },
  ],
})
export class PortfolioModule {}
