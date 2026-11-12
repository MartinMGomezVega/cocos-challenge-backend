import { Decimal } from 'decimal.js';
import { Instrument } from '../../domain/instruments/instrument';
import { MarketPrice } from '../../domain/instruments/market-price';
import { Order } from '../../domain/orders/order';
import { AccountMovement } from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';
import {
  InstrumentRepository,
  SearchInstrumentsRepositoryResult,
} from '../ports/instrument.repository';
import {
  OrderRepository,
  PendingOrderDecision,
} from '../ports/order.repository';
import { UserRepository } from '../ports/user.repository';
import { SubmitOrderUseCase } from './submit-order.use-case';

class FakeUserRepository implements UserRepository {
  private readonly existingIds = new Set<number>();

  setExistingUsers(ids: number[]): void {
    this.existingIds.clear();
    for (const id of ids) {
      this.existingIds.add(id);
    }
  }

  exists(userId: number): Promise<boolean> {
    return Promise.resolve(this.existingIds.has(userId));
  }
}

class FakeInstrumentRepository implements InstrumentRepository {
  private readonly instrumentsById = new Map<number, Instrument>();

  setInstruments(instruments: Instrument[]): void {
    this.instrumentsById.clear();
    for (const inst of instruments) {
      this.instrumentsById.set(inst.id, inst);
    }
  }

  search(): Promise<SearchInstrumentsRepositoryResult> {
    return Promise.resolve({ items: [], total: 0 });
  }

  findByIds(ids: readonly number[]): Promise<Instrument[]> {
    return Promise.resolve(
      ids
        .map((id) => this.instrumentsById.get(id))
        .filter((inst): inst is Instrument => inst !== undefined),
    );
  }

  findById(id: number): Promise<Instrument | null> {
    return Promise.resolve(this.instrumentsById.get(id) ?? null);
  }
}

class FakeOrderRepository implements OrderRepository {
  submitAtomicallyCalls = 0;
  private movementsByUser = new Map<number, AccountMovement[]>();
  private nextId = 12;

  setMovements(userId: number, movements: AccountMovement[]): void {
    this.movementsByUser.set(userId, movements);
  }

  findFilledMovementsByUser(userId: number): Promise<AccountMovement[]> {
    return Promise.resolve(this.movementsByUser.get(userId) ?? []);
  }

  submitAtomically(
    userId: number,
    decide: (movements: AccountMovement[]) => PendingOrderDecision,
  ): Promise<Order> {
    this.submitAtomicallyCalls += 1;
    const movements = this.movementsByUser.get(userId) ?? [];
    const decision = decide(movements);

    return Promise.resolve({
      id: this.nextId++,
      userId,
      instrumentId: decision.instrumentId,
      side: decision.side,
      type: decision.type,
      size: decision.size,
      price: decision.price,
      status: decision.status,
      rejectionReason: decision.rejectionReason,
      datetime: new Date('2026-11-12T16:40:00.000Z'),
    });
  }

  findById(): ReturnType<OrderRepository['findById']> {
    return Promise.resolve(null);
  }

  cancelIfNew(): ReturnType<OrderRepository['cancelIfNew']> {
    return Promise.resolve(null);
  }
}

const PAMP = new Instrument(
  47,
  'PAMP',
  'Pampa Holding S.A.',
  'ACCIONES',
  new MarketPrice(new Decimal('925.85'), new Decimal('921.80')),
);

const ARS = new Instrument(66, 'ARS', 'PESOS', 'MONEDA', null);

const DYCA_UNPRICED = new Instrument(
  10,
  'DYCA',
  'Dycasa S.A.',
  'ACCIONES',
  null,
);

describe('SubmitOrderUseCase', () => {
  let userRepo: FakeUserRepository;
  let instrumentRepo: FakeInstrumentRepository;
  let orderRepo: FakeOrderRepository;
  let useCase: SubmitOrderUseCase;

  beforeEach(() => {
    userRepo = new FakeUserRepository();
    instrumentRepo = new FakeInstrumentRepository();
    orderRepo = new FakeOrderRepository();
    useCase = new SubmitOrderUseCase(userRepo, instrumentRepo, orderRepo);

    userRepo.setExistingUsers([1, 2]);
    instrumentRepo.setInstruments([PAMP, ARS, DYCA_UNPRICED]);
  });

  it('throws USER_NOT_FOUND (NOT_FOUND) when user does not exist without calling orderRepository', async () => {
    await expect(
      useCase.execute({
        userId: 999,
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
      }),
    ).rejects.toMatchObject({
      kind: 'NOT_FOUND',
      code: 'USER_NOT_FOUND',
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(0);
  });

  it('throws INSTRUMENT_NOT_FOUND (NOT_FOUND) when instrument does not exist without calling orderRepository', async () => {
    await expect(
      useCase.execute({
        userId: 1,
        instrumentId: 9999,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
      }),
    ).rejects.toMatchObject({
      kind: 'NOT_FOUND',
      code: 'INSTRUMENT_NOT_FOUND',
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(0);
  });

  it('throws INSTRUMENT_NOT_TRADABLE (VALIDATION) when instrument is MONEDA without calling orderRepository', async () => {
    await expect(
      useCase.execute({
        userId: 1,
        instrumentId: 66,
        side: 'BUY',
        type: 'MARKET',
        size: 100,
      }),
    ).rejects.toMatchObject({
      kind: 'VALIDATION',
      code: 'INSTRUMENT_NOT_TRADABLE',
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(0);
  });

  it('throws MARKET_PRICE_UNAVAILABLE (UNPROCESSABLE) when order is MARKET and instrument has no marketPrice without calling orderRepository', async () => {
    await expect(
      useCase.execute({
        userId: 1,
        instrumentId: 10,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      }),
    ).rejects.toThrow(DomainError);

    await expect(
      useCase.execute({
        userId: 1,
        instrumentId: 10,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
      }),
    ).rejects.toMatchObject({
      kind: 'UNPROCESSABLE',
      code: 'MARKET_PRICE_UNAVAILABLE',
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(0);
  });

  it('submits an accepted order via orderRepository.submitAtomically (including LIMIT on unpriced instrument)', async () => {
    orderRepo.setMovements(1, [
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 100000,
        price: new Decimal('1.00'),
      },
    ]);

    const filledOrder = await useCase.execute({
      userId: 1,
      instrumentId: 47,
      side: 'BUY',
      type: 'MARKET',
      size: 10,
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(1);
    expect(filledOrder).toEqual({
      id: 12,
      userId: 1,
      instrumentId: 47,
      side: 'BUY',
      type: 'MARKET',
      size: 10,
      price: new Decimal('925.85'),
      status: 'FILLED',
      rejectionReason: null,
      datetime: new Date('2026-11-12T16:40:00.000Z'),
    });

    const limitOnUnpriced = await useCase.execute({
      userId: 1,
      instrumentId: 10,
      side: 'BUY',
      type: 'LIMIT',
      size: 1,
      price: new Decimal('100.00'),
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(2);
    expect(limitOnUnpriced.status).toBe('NEW');
    expect(limitOnUnpriced.price).toEqual(new Decimal('100.00'));
  });

  it('submits and persists a REJECTED order via orderRepository.submitAtomically when funds are insufficient', async () => {
    orderRepo.setMovements(2, []);

    const rejectedOrder = await useCase.execute({
      userId: 2,
      instrumentId: 47,
      side: 'BUY',
      type: 'MARKET',
      size: 1,
    });

    expect(orderRepo.submitAtomicallyCalls).toBe(1);
    expect(rejectedOrder).toEqual({
      id: 12,
      userId: 2,
      instrumentId: 47,
      side: 'BUY',
      type: 'MARKET',
      size: 1,
      price: new Decimal('925.85'),
      status: 'REJECTED',
      rejectionReason: 'INSUFFICIENT_FUNDS',
      datetime: new Date('2026-11-12T16:40:00.000Z'),
    });
  });
});
