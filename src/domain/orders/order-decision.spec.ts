import { Decimal } from 'decimal.js';
import { AccountMovement, MovementSide } from '../portfolio/account-movement';
import { DomainError } from '../shared/domain-error';
import { decideOrder } from './order-decision';

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

const USER_1_FILLED_MOVEMENTS: AccountMovement[] = USER_1_SEED_ORDERS.filter(
  (order) => order.status === 'FILLED',
).map((order) => ({
  instrumentId: order.instrumentId,
  side: order.side,
  size: order.size,
  price: new Decimal(order.price),
}));

const PAMP_ID = 47;
const PAMP_CLOSE = new Decimal('925.85');
const BMA_ID = 31;
const BMA_CLOSE = new Decimal('1502.80');
const LOMA_ID = 45;
const LOMA_CLOSE = new Decimal('734.65');

describe('decideOrder', () => {
  describe('Accepted orders (CA1-CA9)', () => {
    it('CA1: accepts BUY MARKET 10 PAMP as FILLED at market price 925.85', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        size: 10,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 10,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });

    it('CA2: accepts SELL MARKET 10 PAMP as FILLED at market price 925.85', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'SELL',
        type: 'MARKET',
        size: 10,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 10,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });

    it('CA3: accepts BUY LIMIT 5 PAMP at 900 as NEW', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'LIMIT',
        size: 5,
        limitPrice: new Decimal('900.00'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 5,
        price: new Decimal('900.00'),
        status: 'NEW',
        rejectionReason: null,
      });
    });

    it('CA4: accepts SELL LIMIT 5 PAMP at 950.50 as NEW', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'SELL',
        type: 'LIMIT',
        size: 5,
        limitPrice: new Decimal('950.50'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 5,
        price: new Decimal('950.50'),
        status: 'NEW',
        rejectionReason: null,
      });
    });

    it('CA5: calculates size 54 for BUY MARKET by amount 50000 in PAMP (floor(50000 / 925.85)) and marks FILLED', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        amount: new Decimal('50000'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 54,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });

    it('CA6: calculates size 55 for BUY LIMIT by amount 50000 in PAMP at 900 (floor(50000 / 900)) and marks NEW', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'LIMIT',
        amount: new Decimal('50000'),
        limitPrice: new Decimal('900'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 55,
        price: new Decimal('900'),
        status: 'NEW',
        rejectionReason: null,
      });
    });

    it('CA7: accepts boundary BUY MARKET 813 PAMP (752716.05 <= 753000 available cash) as FILLED', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        size: 813,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 813,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });

    it('CA8: accepts boundary SELL MARKET 40 PAMP (exact holding of 40 shares) as FILLED', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'SELL',
        type: 'MARKET',
        size: 40,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 40,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });

    it('CA9: accepts BUY LIMIT 1 share at 100 on an instrument without market data (marketPrice null) as NEW', () => {
      const decision = decideOrder({
        instrumentId: 10,
        side: 'BUY',
        type: 'LIMIT',
        size: 1,
        limitPrice: new Decimal('100'),
        marketPrice: null,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 1,
        price: new Decimal('100'),
        status: 'NEW',
        rejectionReason: null,
      });
    });

    it('accepts BUY when cost equals exact availableCash (753000.00) and accepts SELL by amount (S18)', () => {
      const exactCashBuy = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'LIMIT',
        size: 753,
        limitPrice: new Decimal('1000'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });
      expect(exactCashBuy.status).toBe('NEW');
      expect(exactCashBuy.rejectionReason).toBeNull();

      const sellByAmount = decideOrder({
        instrumentId: PAMP_ID,
        side: 'SELL',
        type: 'MARKET',
        amount: new Decimal('10000'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });
      expect(sellByAmount).toEqual({
        size: 10,
        price: new Decimal('925.85'),
        status: 'FILLED',
        rejectionReason: null,
      });
    });
  });

  describe('Rejected orders (CA10-CA17)', () => {
    it('CA10: rejects boundary BUY MARKET 814 PAMP (753641.90 > 753000 available cash) with INSUFFICIENT_FUNDS', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        size: 814,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 814,
        price: new Decimal('925.85'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      });
    });

    it('CA11: rejects BUY LIMIT 1000 PAMP at 900 with INSUFFICIENT_FUNDS and price 900.00', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'LIMIT',
        size: 1000,
        limitPrice: new Decimal('900.00'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 1000,
        price: new Decimal('900.00'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      });
    });

    it('CA12: rejects BUY MARKET by amount 1000000 in PAMP with INSUFFICIENT_FUNDS and size 1080', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        amount: new Decimal('1000000'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 1080,
        price: new Decimal('925.85'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      });
    });

    it('CA13: rejects BUY MARKET 1 PAMP for user 2 (0 cash) with INSUFFICIENT_FUNDS', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        size: 1,
        marketPrice: PAMP_CLOSE,
        movements: [],
      });

      expect(decision).toEqual({
        size: 1,
        price: new Decimal('925.85'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      });
    });

    it('CA14: rejects boundary SELL MARKET 41 PAMP (holding is 40) with INSUFFICIENT_SHARES', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'SELL',
        type: 'MARKET',
        size: 41,
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 41,
        price: new Decimal('925.85'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_SHARES',
      });
    });

    it('CA15: rejects SELL MARKET 1 BMA when holding is negative (-10) with INSUFFICIENT_SHARES', () => {
      const decision = decideOrder({
        instrumentId: BMA_ID,
        side: 'SELL',
        type: 'MARKET',
        size: 1,
        marketPrice: BMA_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 1,
        price: new Decimal('1502.80'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_SHARES',
      });
    });

    it('CA16: rejects SELL MARKET 1 LOMA when user has no holding (0 shares) with INSUFFICIENT_SHARES', () => {
      const decision = decideOrder({
        instrumentId: LOMA_ID,
        side: 'SELL',
        type: 'MARKET',
        size: 1,
        marketPrice: LOMA_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 1,
        price: new Decimal('734.65'),
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_SHARES',
      });
    });

    it('CA17: rejects BUY MARKET by amount 500 in PAMP with AMOUNT_BELOW_PRICE and size 0', () => {
      const decision = decideOrder({
        instrumentId: PAMP_ID,
        side: 'BUY',
        type: 'MARKET',
        amount: new Decimal('500'),
        marketPrice: PAMP_CLOSE,
        movements: USER_1_FILLED_MOVEMENTS,
      });

      expect(decision).toEqual({
        size: 0,
        price: new Decimal('925.85'),
        status: 'REJECTED',
        rejectionReason: 'AMOUNT_BELOW_PRICE',
      });
    });
  });

  describe('Pre-conditions in domain (R2 / R3)', () => {
    it('throws DomainError UNPROCESSABLE with code MARKET_PRICE_UNAVAILABLE when type is MARKET and marketPrice is null', () => {
      expect(() =>
        decideOrder({
          instrumentId: 10,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
          marketPrice: null,
          movements: USER_1_FILLED_MOVEMENTS,
        }),
      ).toThrow(DomainError);

      try {
        decideOrder({
          instrumentId: 10,
          side: 'BUY',
          type: 'MARKET',
          size: 1,
          marketPrice: null,
          movements: USER_1_FILLED_MOVEMENTS,
        });
      } catch (err) {
        expect(err).toMatchObject({
          kind: 'UNPROCESSABLE',
          code: 'MARKET_PRICE_UNAVAILABLE',
        });
      }
    });
  });
});
