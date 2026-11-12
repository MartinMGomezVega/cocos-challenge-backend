import { Order, OrderSide, OrderType } from '../../domain/orders/order';
import { OrderDecision } from '../../domain/orders/order-decision';
import { AccountMovement } from '../../domain/portfolio/account-movement';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface PendingOrderDecision extends OrderDecision {
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
}

export interface OrderRepository {
  findFilledMovementsByUser(userId: number): Promise<AccountMovement[]>;
  submitAtomically(
    userId: number,
    decide: (
      movements: AccountMovement[],
    ) => PendingOrderDecision | Promise<PendingOrderDecision>,
  ): Promise<Order>;
  findById(orderId: number): Promise<Order | null>;
  cancelIfNew(orderId: number): Promise<Order | null>;
}
