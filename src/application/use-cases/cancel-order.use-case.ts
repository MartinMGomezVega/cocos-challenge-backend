import { Order } from '../../domain/orders/order';
import { assertCancellable } from '../../domain/orders/order-cancellation';
import { DomainError } from '../../domain/shared/domain-error';
import { OrderRepository } from '../ports/order.repository';

export class CancelOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new DomainError(
        'ORDER_NOT_FOUND',
        `Order ${orderId} was not found`,
        'NOT_FOUND',
      );
    }

    assertCancellable(order);

    const cancelledOrder = await this.orderRepository.cancelIfNew(orderId);
    if (!cancelledOrder) {
      throw new DomainError(
        'ORDER_NOT_CANCELLABLE',
        `Order ${orderId} is no longer in NEW status and cannot be cancelled`,
        'CONFLICT',
      );
    }

    return cancelledOrder;
  }
}
