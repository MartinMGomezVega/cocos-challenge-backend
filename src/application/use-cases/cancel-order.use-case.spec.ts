import { Decimal } from 'decimal.js';
import { Order, OrderStatus } from '../../domain/orders/order';
import { AccountMovement } from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';
import { OrderRepository } from '../ports/order.repository';
import { CancelOrderUseCase } from './cancel-order.use-case';

function makeOrder(id: number, status: OrderStatus): Order {
  return {
    id,
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

class FakeOrderRepository implements OrderRepository {
  cancelIfNewCalls = 0;
  private readonly ordersById = new Map<number, Order>();
  private forceCancelReturnNull = false;

  setOrder(order: Order): void {
    this.ordersById.set(order.id, order);
  }

  simulateLostRaceOnCancel(): void {
    this.forceCancelReturnNull = true;
  }

  findFilledMovementsByUser(): Promise<AccountMovement[]> {
    return Promise.resolve([]);
  }

  submitAtomically(): ReturnType<OrderRepository['submitAtomically']> {
    return Promise.reject(new Error('Not implemented'));
  }

  findById(orderId: number): Promise<Order | null> {
    return Promise.resolve(this.ordersById.get(orderId) ?? null);
  }

  cancelIfNew(orderId: number): Promise<Order | null> {
    this.cancelIfNewCalls += 1;
    if (this.forceCancelReturnNull) {
      return Promise.resolve(null);
    }
    const existing = this.ordersById.get(orderId);
    if (!existing || existing.status !== 'NEW') {
      return Promise.resolve(null);
    }
    const cancelled: Order = { ...existing, status: 'CANCELLED' };
    this.ordersById.set(orderId, cancelled);
    return Promise.resolve(cancelled);
  }
}

describe('CancelOrderUseCase', () => {
  let orderRepo: FakeOrderRepository;
  let useCase: CancelOrderUseCase;

  beforeEach(() => {
    orderRepo = new FakeOrderRepository();
    useCase = new CancelOrderUseCase(orderRepo);
  });

  it('throws ORDER_NOT_FOUND (NOT_FOUND) when order does not exist without calling cancelIfNew', async () => {
    await expect(useCase.execute(99999)).rejects.toThrow(DomainError);
    await expect(useCase.execute(99999)).rejects.toMatchObject({
      kind: 'NOT_FOUND',
      code: 'ORDER_NOT_FOUND',
    });
    expect(orderRepo.cancelIfNewCalls).toBe(0);
  });

  it.each<OrderStatus>(['FILLED', 'REJECTED', 'CANCELLED'])(
    'throws ORDER_NOT_CANCELLABLE (CONFLICT) when order is in status %s without calling cancelIfNew',
    async (status) => {
      orderRepo.setOrder(makeOrder(12, status));

      await expect(useCase.execute(12)).rejects.toMatchObject({
        kind: 'CONFLICT',
        code: 'ORDER_NOT_CANCELLABLE',
      });
      expect(orderRepo.cancelIfNewCalls).toBe(0);
    },
  );

  it('cancels an order in NEW status and returns it with status CANCELLED', async () => {
    const newOrder = makeOrder(12, 'NEW');
    orderRepo.setOrder(newOrder);

    const result = await useCase.execute(12);

    expect(orderRepo.cancelIfNewCalls).toBe(1);
    expect(result).toEqual({
      ...newOrder,
      status: 'CANCELLED',
    });
  });

  it('throws ORDER_NOT_CANCELLABLE (CONFLICT) when cancelIfNew returns null due to a lost race without asserting an unverified status', async () => {
    orderRepo.setOrder(makeOrder(12, 'NEW'));
    orderRepo.simulateLostRaceOnCancel();

    let caughtError: unknown;
    try {
      await useCase.execute(12);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(DomainError);
    expect(caughtError).toMatchObject({
      kind: 'CONFLICT',
      code: 'ORDER_NOT_CANCELLABLE',
    });
    expect((caughtError as DomainError).message).not.toContain('CANCELLED');
    expect(orderRepo.cancelIfNewCalls).toBe(1);
  });
});
