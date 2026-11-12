import { Decimal } from 'decimal.js';
import { Instrument } from '../instruments/instrument';
import { MarketPrice } from '../instruments/market-price';
import { toFixed2 } from '../shared/decimal-format';
import { Money } from '../shared/money';
import { AccountMovement, MovementSide } from './account-movement';
import { calculateAvailableCash } from './cash-calculator';
import { buildPortfolio } from './portfolio';
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

const USER_1_INSTRUMENTS: Instrument[] = [
  new Instrument(
    31,
    'BMA',
    'Banco Macro S.A.',
    'ACCIONES',
    new MarketPrice(new Decimal('1502.80'), new Decimal('1520.25')),
  ),
  new Instrument(
    45,
    'LOMA',
    'Loma Negra C.I.A.S.A.',
    'ACCIONES',
    new MarketPrice(new Decimal('734.65'), new Decimal('734.35')),
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
];

describe('buildPortfolio', () => {
  it('calculates user 1 complete portfolio from the 11 seed orders filtering FILLED (CA1 to CA5)', () => {
    const filledMovements: AccountMovement[] = USER_1_SEED_ORDERS.filter(
      (order) => order.status === 'FILLED',
    ).map((order) => ({
      instrumentId: order.instrumentId,
      side: order.side,
      size: order.size,
      price: new Decimal(order.price),
    }));

    const availableCash = calculateAvailableCash(filledMovements);
    const holdings = calculateHoldings(filledMovements);

    const portfolio = buildPortfolio({
      userId: 1,
      availableCash,
      holdings,
      instruments: USER_1_INSTRUMENTS,
    });

    expect(portfolio.userId).toBe(1);
    expect(portfolio.availableCash.toFixed2()).toBe('753000.00');
    expect(portfolio.totalAccountValue.toFixed2()).toBe('889756.00');
    expect(portfolio.positions.map((p) => p.ticker)).toEqual([
      'BMA',
      'METR',
      'PAMP',
    ]);

    const [bma, metr, pamp] = portfolio.positions;

    expect(bma.instrumentId).toBe(31);
    expect(bma.ticker).toBe('BMA');
    expect(bma.name).toBe('Banco Macro S.A.');
    expect(bma.quantity).toBe(-10);
    expect(bma.marketValue?.toFixed2()).toBe('-15028.00');
    expect(bma.totalReturnPct).toBeNull();
    expect(toFixed2(bma.dailyReturnPct!)).toBe('-1.15');

    expect(metr.instrumentId).toBe(54);
    expect(metr.ticker).toBe('METR');
    expect(metr.name).toBe('MetroGAS S.A.');
    expect(metr.quantity).toBe(500);
    expect(metr.marketValue?.toFixed2()).toBe('114750.00');
    expect(toFixed2(metr.totalReturnPct!)).toBe('-8.20');
    expect(toFixed2(metr.dailyReturnPct!)).toBe('-1.08');

    expect(pamp.instrumentId).toBe(47);
    expect(pamp.ticker).toBe('PAMP');
    expect(pamp.name).toBe('Pampa Energía S.A.');
    expect(pamp.quantity).toBe(40);
    expect(pamp.marketValue?.toFixed2()).toBe('37034.00');
    expect(toFixed2(pamp.totalReturnPct!)).toBe('-0.45');
    expect(toFixed2(pamp.dailyReturnPct!)).toBe('0.44');
  });

  it('sets totalReturnPct to null when quantity is negative, when there are no buys, or when averageBuyPrice is 0', () => {
    const portfolio = buildPortfolio({
      userId: 1,
      availableCash: Money.zero(),
      holdings: [
        {
          instrumentId: 31,
          quantity: -10,
          averageBuyPrice: new Decimal('1540'),
        },
        {
          instrumentId: 47,
          quantity: 10,
          averageBuyPrice: null,
        },
        {
          instrumentId: 54,
          quantity: 10,
          averageBuyPrice: new Decimal('0'),
        },
      ],
      instruments: USER_1_INSTRUMENTS,
    });

    expect(portfolio.positions).toHaveLength(3);
    expect(portfolio.positions[0].totalReturnPct).toBeNull();
    expect(portfolio.positions[1].totalReturnPct).toBeNull();
    expect(portfolio.positions[2].totalReturnPct).toBeNull();
  });

  it('handles an instrument without market data with null values and does not add it to totalAccountValue (CA12)', () => {
    const unpricedInstrument = new Instrument(
      10,
      'DYCA',
      'Dycasa S.A.',
      'ACCIONES',
      null,
    );

    const portfolio = buildPortfolio({
      userId: 1,
      availableCash: Money.from('10000'),
      holdings: [
        {
          instrumentId: 10,
          quantity: 25,
          averageBuyPrice: new Decimal('100'),
        },
        {
          instrumentId: 47,
          quantity: 10,
          averageBuyPrice: new Decimal('900'),
        },
      ],
      instruments: [unpricedInstrument, ...USER_1_INSTRUMENTS],
    });

    expect(portfolio.positions.map((p) => p.ticker)).toEqual(['DYCA', 'PAMP']);

    const dyca = portfolio.positions[0];
    expect(dyca.quantity).toBe(25);
    expect(dyca.marketValue).toBeNull();
    expect(dyca.totalReturnPct).toBeNull();
    expect(dyca.dailyReturnPct).toBeNull();

    // 10000 cash + (10 * 925.85 = 9258.50) = 19258.50; DYCA does not add to total
    expect(portfolio.totalAccountValue.toFixed2()).toBe('19258.50');
  });

  it('excludes MONEDA instruments and holdings without a matching instrument', () => {
    const arsInstrument = new Instrument(66, 'ARS', 'PESOS', 'MONEDA', null);

    const portfolio = buildPortfolio({
      userId: 1,
      availableCash: Money.from('5000'),
      holdings: [
        {
          instrumentId: 66,
          quantity: 5000,
          averageBuyPrice: new Decimal('1'),
        },
        {
          instrumentId: 999,
          quantity: 10,
          averageBuyPrice: new Decimal('100'),
        },
      ],
      instruments: [arsInstrument],
    });

    expect(portfolio.positions).toEqual([]);
    expect(portfolio.totalAccountValue.toFixed2()).toBe('5000.00');
  });

  it('orders positions by ticker ascending regardless of holdings order', () => {
    const portfolio = buildPortfolio({
      userId: 1,
      availableCash: Money.zero(),
      holdings: [
        {
          instrumentId: 47,
          quantity: 1,
          averageBuyPrice: new Decimal('900'),
        },
        {
          instrumentId: 54,
          quantity: 1,
          averageBuyPrice: new Decimal('200'),
        },
        {
          instrumentId: 31,
          quantity: 1,
          averageBuyPrice: new Decimal('1500'),
        },
      ],
      instruments: USER_1_INSTRUMENTS,
    });

    expect(portfolio.positions.map((p) => p.ticker)).toEqual([
      'BMA',
      'METR',
      'PAMP',
    ]);
  });

  it('returns 0.00 cash, 0.00 totalAccountValue and empty positions for an empty account', () => {
    const portfolio = buildPortfolio({
      userId: 2,
      availableCash: Money.zero(),
      holdings: [],
      instruments: [],
    });

    expect(portfolio.userId).toBe(2);
    expect(portfolio.availableCash.toFixed2()).toBe('0.00');
    expect(portfolio.totalAccountValue.toFixed2()).toBe('0.00');
    expect(portfolio.positions).toEqual([]);
  });
});
