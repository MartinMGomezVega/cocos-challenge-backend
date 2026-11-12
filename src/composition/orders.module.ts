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
import { CancelOrderUseCase } from '../application/use-cases/cancel-order.use-case';
import { SubmitOrderUseCase } from '../application/use-cases/submit-order.use-case';
import { TypeOrmInstrumentRepository } from '../infrastructure/repositories/typeorm-instrument.repository';
import { TypeOrmOrderRepository } from '../infrastructure/repositories/typeorm-order.repository';
import { TypeOrmUserRepository } from '../infrastructure/repositories/typeorm-user.repository';
import { OrdersController } from '../presentation/controllers/orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: INSTRUMENT_REPOSITORY,
      useClass: TypeOrmInstrumentRepository,
    },
    {
      provide: ORDER_REPOSITORY,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: SubmitOrderUseCase,
      inject: [USER_REPOSITORY, INSTRUMENT_REPOSITORY, ORDER_REPOSITORY],
      useFactory: (
        userRepository: UserRepository,
        instrumentRepository: InstrumentRepository,
        orderRepository: OrderRepository,
      ) =>
        new SubmitOrderUseCase(
          userRepository,
          instrumentRepository,
          orderRepository,
        ),
    },
    {
      provide: CancelOrderUseCase,
      inject: [ORDER_REPOSITORY],
      useFactory: (orderRepository: OrderRepository) =>
        new CancelOrderUseCase(orderRepository),
    },
  ],
})
export class OrdersModule {}
