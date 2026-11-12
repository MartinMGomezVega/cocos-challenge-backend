import { Decimal } from 'decimal.js';
import { toFixed2 } from './decimal-format';

describe('toFixed2', () => {
  it('formats with 2 decimals using half-up rounding away from zero', () => {
    expect(toFixed2(new Decimal('0.005'))).toBe('0.01');
    expect(toFixed2(new Decimal('0.004'))).toBe('0.00');
    expect(toFixed2(new Decimal('-0.4462'))).toBe('-0.45');
    expect(toFixed2(new Decimal(889756))).toBe('889756.00');
    expect(toFixed2(new Decimal('-0.005'))).toBe('-0.01');
    expect(toFixed2(new Decimal('-0.004'))).toBe('0.00');
    expect(toFixed2(new Decimal(0))).toBe('0.00');
    expect(toFixed2(new Decimal('-0'))).toBe('0.00');
  });
});
