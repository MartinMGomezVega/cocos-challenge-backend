import { Decimal } from 'decimal.js';
import { Money } from './money';

describe('Money', () => {
  describe('construction', () => {
    it('creates Money from valid strings (positive, negative, integer, decimal)', () => {
      expect(Money.from('0').toDecimal()).toEqual(new Decimal(0));
      expect(Money.from('930.00').toDecimal()).toEqual(new Decimal('930.00'));
      expect(Money.from('-15028.50').toDecimal()).toEqual(
        new Decimal('-15028.50'),
      );
    });

    it('creates Money from safe integer numbers (positive, negative, zero)', () => {
      expect(Money.from(0).toDecimal()).toEqual(new Decimal(0));
      expect(Money.from(889756).toDecimal()).toEqual(new Decimal(889756));
      expect(Money.from(-42).toDecimal()).toEqual(new Decimal(-42));
    });

    it('creates Money from finite Decimal instances', () => {
      const dec = new Decimal('925.85');
      expect(Money.from(dec).toDecimal()).toEqual(dec);
      expect(Money.from(new Decimal('-0.4462')).toDecimal()).toEqual(
        new Decimal('-0.4462'),
      );
    });

    it('creates zero Money via Money.zero()', () => {
      const zero = Money.zero();
      expect(zero.toDecimal()).toEqual(new Decimal(0));
      expect(zero.toFixed2()).toBe('0.00');
    });

    it('rejects non-safe-integer numbers', () => {
      expect(() => Money.from(1.5)).toThrow(Error);
      expect(() => Money.from(-0.01)).toThrow(Error);
      expect(() => Money.from(Number.NaN)).toThrow(Error);
      expect(() => Money.from(Number.POSITIVE_INFINITY)).toThrow(Error);
      expect(() => Money.from(Number.NEGATIVE_INFINITY)).toThrow(Error);
      expect(() => Money.from(Number.MAX_SAFE_INTEGER + 1)).toThrow(Error);
    });

    it('rejects invalid strings', () => {
      expect(() => Money.from('')).toThrow(Error);
      expect(() => Money.from('   ')).toThrow(Error);
      expect(() => Money.from('abc')).toThrow(Error);
      expect(() => Money.from('12.34.56')).toThrow(Error);
      expect(() => Money.from('.5')).toThrow(Error);
      expect(() => Money.from('5.')).toThrow(Error);
      expect(() => Money.from('+10')).toThrow(Error);
      expect(() => Money.from('1e5')).toThrow(Error);
      expect(() => Money.from(' 100 ')).toThrow(Error);
      expect(() => Money.from('NaN')).toThrow(Error);
      expect(() => Money.from('Infinity')).toThrow(Error);
    });

    it('rejects non-finite Decimal values', () => {
      expect(() => Money.from(new Decimal(Number.NaN))).toThrow(Error);
      expect(() => Money.from(new Decimal(Number.POSITIVE_INFINITY))).toThrow(
        Error,
      );
      expect(() => Money.from(new Decimal(Number.NEGATIVE_INFINITY))).toThrow(
        Error,
      );
    });

    it('rejects unexpected runtime types', () => {
      expect(() => Money.from(null as unknown as string)).toThrow(Error);
      expect(() => Money.from(undefined as unknown as string)).toThrow(Error);
    });
  });

  describe('arithmetic operations and immutability', () => {
    it('adds two Money instances and returns a new instance without mutating operands', () => {
      const a = Money.from('100.25');
      const b = Money.from('50.75');

      const sum = a.add(b);

      expect(sum.toDecimal()).toEqual(new Decimal('151.00'));
      expect(a.toDecimal()).toEqual(new Decimal('100.25'));
      expect(b.toDecimal()).toEqual(new Decimal('50.75'));
      expect(sum).not.toBe(a);
      expect(sum).not.toBe(b);
    });

    it('subtracts two Money instances and supports negative results without mutating operands', () => {
      const a = Money.from('100.00');
      const b = Money.from('150.50');

      const diff = a.subtract(b);

      expect(diff.toDecimal()).toEqual(new Decimal('-50.50'));
      expect(a.toDecimal()).toEqual(new Decimal('100.00'));
      expect(b.toDecimal()).toEqual(new Decimal('150.50'));
      expect(diff).not.toBe(a);
    });

    it('multiplies by a safe integer factor (positive, negative, zero) without mutating operand', () => {
      const price = Money.from('925.85');

      const total = price.multiply(40);
      const negTotal = price.multiply(-10);
      const zeroTotal = price.multiply(0);

      expect(total.toDecimal()).toEqual(new Decimal('37034.00'));
      expect(negTotal.toDecimal()).toEqual(new Decimal('-9258.50'));
      expect(zeroTotal.toDecimal()).toEqual(new Decimal(0));
      expect(price.toDecimal()).toEqual(new Decimal('925.85'));
    });

    it('rejects multiplication by non-safe-integer factors', () => {
      const price = Money.from('100');

      expect(() => price.multiply(1.5)).toThrow(Error);
      expect(() => price.multiply(Number.NaN)).toThrow(Error);
      expect(() => price.multiply(Number.POSITIVE_INFINITY)).toThrow(Error);
      expect(() => price.multiply(Number.MAX_SAFE_INTEGER + 1)).toThrow(Error);
    });

    it('preserves full internal precision across operations before toFixed2()', () => {
      const part = Money.from('0.004');
      const sum = part.add(part); // 0.008 internally -> 0.01 when rounded
      expect(sum.toDecimal()).toEqual(new Decimal('0.008'));
      expect(sum.toFixed2()).toBe('0.01');
    });
  });

  describe('comparisons', () => {
    const ten = Money.from('10.00');
    const tenInt = Money.from(10);
    const twenty = Money.from('20.00');
    const minusFive = Money.from('-5.00');

    it('checks equality with equals()', () => {
      expect(ten.equals(tenInt)).toBe(true);
      expect(ten.equals(twenty)).toBe(false);
    });

    it('compares with greaterThan()', () => {
      expect(twenty.greaterThan(ten)).toBe(true);
      expect(ten.greaterThan(tenInt)).toBe(false);
      expect(ten.greaterThan(twenty)).toBe(false);
      expect(ten.greaterThan(minusFive)).toBe(true);
    });

    it('compares with greaterThanOrEqual()', () => {
      expect(twenty.greaterThanOrEqual(ten)).toBe(true);
      expect(ten.greaterThanOrEqual(tenInt)).toBe(true);
      expect(ten.greaterThanOrEqual(twenty)).toBe(false);
    });

    it('compares with lessThan()', () => {
      expect(ten.lessThan(twenty)).toBe(true);
      expect(ten.lessThan(tenInt)).toBe(false);
      expect(twenty.lessThan(ten)).toBe(false);
      expect(minusFive.lessThan(ten)).toBe(true);
    });
  });

  describe('toFixed2() half-up rounding', () => {
    it('formats with 2 decimals using half-up rounding away from zero', () => {
      expect(Money.from('0.005').toFixed2()).toBe('0.01');
      expect(Money.from('0.004').toFixed2()).toBe('0.00');
      expect(Money.from('-0.4462').toFixed2()).toBe('-0.45');
      expect(Money.from(889756).toFixed2()).toBe('889756.00');
      expect(Money.from('-0.005').toFixed2()).toBe('-0.01');
      expect(Money.from('-0.004').toFixed2()).toBe('0.00');
      expect(Money.from(0).toFixed2()).toBe('0.00');
    });
  });
});
