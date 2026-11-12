import { Decimal } from 'decimal.js';
import { Money } from '../shared/money';
import { AccountMovement, MovementSide } from './account-movement';
import { calculateAvailableCash } from './cash-calculator';

interface SeedOrderRow {
  id: number;
  instrumentId: number;
  size: number;
  price: string;
  type: 'MARKET' | 'LIMIT';
  side: MovementSide;
  status: 'FILLED' | 'NEW' | 'REJECTED' | 'CANCELLED';
}

const USER_1_SEED_ORDERS: SeedOrderRow[] = [
  {
    id: 1,
    instrumentId: 66,
    size: 1000000,
    price: '1.00',
    type: 'MARKET',
    side: 'CASH_IN',
    status: 'FILLED',
  },
  {
    id: 2,
    instrumentId: 47,
    size: 50,
    price: '930.00',
    type: 'MARKET',
    side: 'BUY',
    status: 'FILLED',
  },
  {
    id: 3,
    instrumentId: 47,
    size: 50,
    price: '920.00',
    type: 'LIMIT',
    side: 'BUY',
    status: 'CANCELLED',
  },
  {
    id: 4,
    instrumentId: 47,
    size: 10,
    price: '940.00',
    type: 'MARKET',
    side: 'SELL',
    status: 'FILLED',
  },
  {
    id: 5,
    instrumentId: 45,
    size: 50,
    price: '710.00',
    type: 'LIMIT',
    side: 'BUY',
    status: 'NEW',
  },
  {
    id: 6,
    instrumentId: 47,
    size: 100,
    price: '950.00',
    type: 'MARKET',
    side: 'SELL',
    status: 'REJECTED',
  },
  {
    id: 7,
    instrumentId: 31,
    size: 60,
    price: '1500.00',
    type: 'LIMIT',
    side: 'BUY',
    status: 'NEW',
  },
  {
    id: 8,
    instrumentId: 66,
    size: 100000,
    price: '1.00',
    type: 'MARKET',
    side: 'CASH_OUT',
    status: 'FILLED',
  },
  {
    id: 9,
    instrumentId: 31,
    size: 20,
    price: '1540.00',
    type: 'LIMIT',
    side: 'BUY',
    status: 'FILLED',
  },
  {
    id: 10,
    instrumentId: 54,
    size: 500,
    price: '250.00',
    type: 'MARKET',
    side: 'BUY',
    status: 'FILLED',
  },
  {
    id: 11,
    instrumentId: 31,
    size: 30,
    price: '1530.00',
    type: 'MARKET',
    side: 'SELL',
    status: 'FILLED',
  },
];

describe('calculateAvailableCash', () => {
  it('calculates 753000.00 from the 11 seed orders of user 1 filtering FILLED', () => {
    const filledMovements: AccountMovement[] = USER_1_SEED_ORDERS.filter(
      (order) => order.status === 'FILLED',
    ).map((order) => ({
      instrumentId: order.instrumentId,
      side: order.side,
      size: order.size,
      price: new Decimal(order.price),
    }));

    expect(filledMovements).toHaveLength(7);

    const cash = calculateAvailableCash(filledMovements);
    expect(cash.equals(Money.from('753000'))).toBe(true);
    expect(cash.toFixed2()).toBe('753000.00');
  });

  it('adds size * price for CASH_IN', () => {
    const cash = calculateAvailableCash([
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 25000,
        price: new Decimal('1.00'),
      },
    ]);
    expect(cash.toFixed2()).toBe('25000.00');
  });

  it('adds size * price for SELL', () => {
    const cash = calculateAvailableCash([
      {
        instrumentId: 47,
        side: 'SELL',
        size: 10,
        price: new Decimal('940.50'),
      },
    ]);
    expect(cash.toFixed2()).toBe('9405.00');
  });

  it('subtracts size * price for CASH_OUT', () => {
    const cash = calculateAvailableCash([
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 50000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 66,
        side: 'CASH_OUT',
        size: 15000,
        price: new Decimal('1.00'),
      },
    ]);
    expect(cash.toFixed2()).toBe('35000.00');
  });

  it('subtracts size * price for BUY', () => {
    const cash = calculateAvailableCash([
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 50000,
        price: new Decimal('1.00'),
      },
      {
        instrumentId: 47,
        side: 'BUY',
        size: 10,
        price: new Decimal('930.25'),
      },
    ]);
    expect(cash.toFixed2()).toBe('40697.50');
  });

  it('returns 0 for an empty movement list', () => {
    const cash = calculateAvailableCash([]);
    expect(cash.equals(Money.zero())).toBe(true);
    expect(cash.toFixed2()).toBe('0.00');
  });

  it('allows negative result when outflows exceed inflows', () => {
    const cash = calculateAvailableCash([
      {
        instrumentId: 47,
        side: 'BUY',
        size: 5,
        price: new Decimal('100.00'),
      },
    ]);
    expect(cash.equals(Money.from('-500'))).toBe(true);
    expect(cash.toFixed2()).toBe('-500.00');
  });
});
