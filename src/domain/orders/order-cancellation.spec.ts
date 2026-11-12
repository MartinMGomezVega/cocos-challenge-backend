import { Decimal } from 'decimal.js';
import { DomainError } from '../shared/domain-error';
import { Order, OrderStatus } from './order';
import { assertCancellable } from './order-cancellation';

function makeOrder(status: OrderStatus): Order {
  return {
    id: 12,
    userId: 1,
    instrumentId: 47,
    side: 'BUY',
    type: 'LIMIT',
    size: 5,
    price: new Decimal('900.00'),
    status,
    rejectionReason: null,
    datetime: new Date('2026-11-12T16:40:00.000Z'),
  };
}

describe('assertCancellable', () => {
  it('does not throw when order status is NEW', () => {
    expect(() => assertCancellable(makeOrder('NEW'))).not.toThrow();
  });

  it.each<OrderStatus>(['FILLED', 'REJECTED', 'CANCELLED'])(
    'throws DomainError CONFLICT with code ORDER_NOT_CANCELLABLE when status is %s',
    (status) => {
      const order = makeOrder(status);

      expect(() => assertCancellable(order)).toThrow(DomainError);

      try {
        assertCancellable(order);
      } catch (err) {
        expect(err).toMatchObject({
          kind: 'CONFLICT',
          code: 'ORDER_NOT_CANCELLABLE',
        });
      }
    },
  );
});
