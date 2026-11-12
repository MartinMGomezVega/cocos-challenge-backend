import { Decimal } from 'decimal.js';
import { Instrument } from '../../domain/instruments/instrument';
import { MarketPrice } from '../../domain/instruments/market-price';
import { AccountMovement } from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';
import {
  InstrumentRepository,
  SearchInstrumentsRepositoryResult,
} from '../ports/instrument.repository';
import { OrderRepository } from '../ports/order.repository';
import { UserRepository } from '../ports/user.repository';
import { GetPortfolioUseCase } from './get-portfolio.use-case';

class FakeUserRepository implements UserRepository {
  private readonly existingUserIds = new Set<number>();

  setExistingUsers(userIds: number[]): void {
    this.existingUserIds.clear();
    for (const id of userIds) {
      this.existingUserIds.add(id);
    }
  }

  exists(userId: number): Promise<boolean> {
    return Promise.resolve(this.existingUserIds.has(userId));
  }
}

class FakeOrderRepository implements OrderRepository {
  private readonly movementsByUser = new Map<number, AccountMovement[]>();

  setMovements(userId: number, movements: AccountMovement[]): void {
    this.movementsByUser.set(userId, movements);
  }

  findFilledMovementsByUser(userId: number): Promise<AccountMovement[]> {
    return Promise.resolve(this.movementsByUser.get(userId) ?? []);
  }

  submitAtomically(): ReturnType<OrderRepository['submitAtomically']> {
    return Promise.reject(new Error('Not implemented'));
  }

  findById(): ReturnType<OrderRepository['findById']> {
    return Promise.resolve(null);
  }

  cancelIfNew(): ReturnType<OrderRepository['cancelIfNew']> {
    return Promise.resolve(null);
  }
}

class FakeInstrumentRepository implements InstrumentRepository {
  findByIdsCalls: Array<readonly number[]> = [];
  private instruments: Instrument[] = [];

  setInstruments(instruments: Instrument[]): void {
    this.instruments = instruments;
  }

  search(): Promise<SearchInstrumentsRepositoryResult> {
    return Promise.resolve({ items: [], total: 0 });
  }

  findByIds(ids: readonly number[]): Promise<Instrument[]> {
    this.findByIdsCalls.push(ids);
    const idSet = new Set(ids);
    return Promise.resolve(
      this.instruments.filter((inst) => idSet.has(inst.id)),
    );
  }

  findById(): Promise<Instrument | null> {
    return Promise.resolve(null);
  }
}

describe('GetPortfolioUseCase', () => {
  let userRepo: FakeUserRepository;
  let orderRepo: FakeOrderRepository;
  let instrumentRepo: FakeInstrumentRepository;
  let useCase: GetPortfolioUseCase;

  beforeEach(() => {
    userRepo = new FakeUserRepository();
    orderRepo = new FakeOrderRepository();
    instrumentRepo = new FakeInstrumentRepository();
    useCase = new GetPortfolioUseCase(userRepo, orderRepo, instrumentRepo);
  });

  it('throws DomainError with kind NOT_FOUND and code USER_NOT_FOUND when user does not exist', async () => {
    userRepo.setExistingUsers([1]);

    await expect(useCase.execute(999)).rejects.toThrow(DomainError);
    await expect(useCase.execute(999)).rejects.toMatchObject({
      kind: 'NOT_FOUND',
      code: 'USER_NOT_FOUND',
    });
    expect(instrumentRepo.findByIdsCalls).toHaveLength(0);
  });

  it('returns empty portfolio with 0 cash and 0 total value without calling findByIds when user has no orders', async () => {
    userRepo.setExistingUsers([2]);
    orderRepo.setMovements(2, []);

    const portfolio = await useCase.execute(2);

    expect(portfolio.userId).toBe(2);
    expect(portfolio.availableCash.toFixed2()).toBe('0.00');
    expect(portfolio.totalAccountValue.toFixed2()).toBe('0.00');
    expect(portfolio.positions).toEqual([]);
    expect(instrumentRepo.findByIdsCalls).toHaveLength(0);
  });

  it('builds the complete portfolio for user 1 from filled movements and instruments', async () => {
    userRepo.setExistingUsers([1]);
    orderRepo.setMovements(1, [
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 1000000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 47,
        side: 'BUY',
        size: 50,
        price: new Decimal('930.00'),
      },
      {
        instrumentId: 47,
        side: 'SELL',
        size: 10,
        price: new Decimal('940.00'),
      },
      {
        instrumentId: 66,
        side: 'CASH_OUT',
        size: 100000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 31,
        side: 'BUY',
        size: 20,
        price: new Decimal('1540.00'),
      },
      {
        instrumentId: 54,
        side: 'BUY',
        size: 500,
        price: new Decimal('250.00'),
      },
      {
        instrumentId: 31,
        side: 'SELL',
        size: 30,
        price: new Decimal('1530.00'),
      },
    ]);
    instrumentRepo.setInstruments([
      new Instrument(
        31,
        'BMA',
        'Banco Macro S.A.',
        'ACCIONES',
        new MarketPrice(new Decimal('1502.80'), new Decimal('1520.25')),
      ),
      new Instrument(
        47,
        'PAMP',
        'Pampa Energía S.A.',
        'ACCIONES',
        new MarketPrice(new Decimal('925.85'), new Decimal('921.80')),
      ),
      new Instrument(
        54,
        'METR',
        'MetroGAS S.A.',
        'ACCIONES',
        new MarketPrice(new Decimal('229.50'), new Decimal('232.00')),
      ),
    ]);

    const portfolio = await useCase.execute(1);

    expect(instrumentRepo.findByIdsCalls).toEqual([[47, 31, 54]]);
    expect(portfolio.userId).toBe(1);
    expect(portfolio.availableCash.toFixed2()).toBe('753000.00');
    expect(portfolio.totalAccountValue.toFixed2()).toBe('889756.00');
    expect(portfolio.positions.map((p) => p.ticker)).toEqual([
      'BMA',
      'METR',
      'PAMP',
    ]);
  });
});
