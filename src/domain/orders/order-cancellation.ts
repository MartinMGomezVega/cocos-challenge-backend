import { DomainError } from '../shared/domain-error';
import { Order } from './order';

export function assertCancellable(
  order: Order & { readonly status: Exclude<Order['status'], 'NEW'> },
): never;
export function assertCancellable(order: Order): void;
export function assertCancellable(order: Order): void {
  if (order.status !== 'NEW') {
    throw new DomainError(
      'ORDER_NOT_CANCELLABLE',
      `Order ${order.id} cannot be cancelled in status ${order.status}`,
      'CONFLICT',
    );
  }
}
