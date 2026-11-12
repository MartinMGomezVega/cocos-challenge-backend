import { Decimal } from 'decimal.js';
import { AccountMovement, MovementSide } from './account-movement';
import { calculateHoldings } from './position-calculator';

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

describe('calculateHoldings', () => {
  it('calculates user 1 holdings from the 11 seed orders filtering FILLED (PAMP 40, METR 500, BMA -10)', () => {
    const filledMovements: AccountMovement[] = USER_1_SEED_ORDERS.filter(
      (order) => order.status === 'FILLED',
    ).map((order) => ({
      instrumentId: order.instrumentId,
      side: order.side,
      size: order.size,
      price: new Decimal(order.price),
    }));

    const holdings = calculateHoldings(filledMovements);

    expect(holdings).toHaveLength(3);

    const pamp = holdings.find((h) => h.instrumentId === 47);
    expect(pamp).toEqual({
      instrumentId: 47,
      quantity: 40,
      averageBuyPrice: new Decimal('930'),
    });

    const metr = holdings.find((h) => h.instrumentId === 54);
    expect(metr).toEqual({
      instrumentId: 54,
      quantity: 500,
      averageBuyPrice: new Decimal('250'),
    });

    const bma = holdings.find((h) => h.instrumentId === 31);
    expect(bma).toEqual({
      instrumentId: 31,
      quantity: -10,
      averageBuyPrice: new Decimal('1540'),
    });
  });

  it('computes weighted average buy price across multiple BUY orders (CA11: 10 @ 100 and 30 @ 200 -> 175)', () => {
    const holdings = calculateHoldings([
      {
        instrumentId: 47,
        side: 'BUY',
        size: 10,
        price: new Decimal('100'),
      },
      {
        instrumentId: 47,
        side: 'BUY',
        size: 30,
        price: new Decimal('200'),
      },
    ]);

    expect(holdings).toEqual([
      {
        instrumentId: 47,
        quantity: 40,
        averageBuyPrice: new Decimal('175'),
      },
    ]);
  });

  it('excludes holdings whose net quantity reaches 0 after full sale', () => {
    const holdings = calculateHoldings([
      {
        instrumentId: 47,
        side: 'BUY',
        size: 10,
        price: new Decimal('900'),
      },
      {
        instrumentId: 47,
        side: 'SELL',
        size: 10,
        price: new Decimal('950'),
      },
    ]);

    expect(holdings).toEqual([]);
  });

  it('ignores CASH_IN and CASH_OUT transfers when building holdings', () => {
    const holdings = calculateHoldings([
      {
        instrumentId: 66,
        side: 'CASH_IN',
        size: 100000,
        price: new Decimal('1'),
      },
      {
        instrumentId: 66,
        side: 'CASH_OUT',
        size: 20000,
        price: new Decimal('1'),
      },
    ]);

    expect(holdings).toEqual([]);
  });

  it('sets averageBuyPrice to null when a holding has SELL movements without any BUY', () => {
    const holdings = calculateHoldings([
      {
        instrumentId: 31,
        side: 'SELL',
        size: 15,
        price: new Decimal('1530'),
      },
    ]);

    expect(holdings).toEqual([
      {
        instrumentId: 31,
        quantity: -15,
        averageBuyPrice: null,
      },
    ]);
  });
});
