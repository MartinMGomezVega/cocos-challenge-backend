import { Decimal } from 'decimal.js';
import { Order, OrderSide, OrderType } from '../../domain/orders/order';
import { decideOrder } from '../../domain/orders/order-decision';
import { DomainError } from '../../domain/shared/domain-error';
import { InstrumentRepository } from '../ports/instrument.repository';
import { OrderRepository } from '../ports/order.repository';
import { UserRepository } from '../ports/user.repository';

export interface SubmitOrderInput {
  readonly userId: number;
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size?: number;
  readonly amount?: Decimal;
  readonly price?: Decimal;
}

export class SubmitOrderUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly instrumentRepository: InstrumentRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(input: SubmitOrderInput): Promise<Order> {
    const userExists = await this.userRepository.exists(input.userId);
    if (!userExists) {
      throw new DomainError(
        'USER_NOT_FOUND',
        `User ${input.userId} was not found`,
        'NOT_FOUND',
      );
    }

    const instrument = await this.instrumentRepository.findById(
      input.instrumentId,
    );
    if (!instrument) {
      throw new DomainError(
        'INSTRUMENT_NOT_FOUND',
        `Instrument ${input.instrumentId} was not found`,
        'NOT_FOUND',
      );
    }

    if (instrument.type === 'MONEDA') {
      throw new DomainError(
        'INSTRUMENT_NOT_TRADABLE',
        `Instrument ${input.instrumentId} is not tradable`,
        'VALIDATION',
      );
    }

    if (input.type === 'MARKET' && instrument.marketPrice === null) {
      throw new DomainError(
        'MARKET_PRICE_UNAVAILABLE',
        `Market price is unavailable for instrument ${input.instrumentId}`,
        'UNPROCESSABLE',
      );
    }

    const marketPrice = instrument.marketPrice
      ? instrument.marketPrice.close
      : null;

    return this.orderRepository.submitAtomically(input.userId, (movements) => {
      const decision = decideOrder({
        instrumentId: instrument.id,
        side: input.side,
        type: input.type,
        size: input.size,
        amount: input.amount,
        limitPrice: input.price,
        marketPrice,
        movements,
      });

      return {
        instrumentId: instrument.id,
        side: input.side,
        type: input.type,
        ...decision,
      };
    });
  }
}
