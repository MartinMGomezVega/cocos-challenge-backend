import { Decimal } from 'decimal.js';
import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  describe('from (database -> entity)', () => {
    it('converts a numeric string to Decimal', () => {
      const result = decimalTransformer.from('930.00');
      expect(Decimal.isDecimal(result)).toBe(true);
      expect(result).toEqual(new Decimal(930));
    });

    it('preserves null and undefined as null', () => {
      expect(decimalTransformer.from(null)).toBeNull();
      expect(decimalTransformer.from(undefined)).toBeNull();
    });
  });

  describe('to (entity -> database)', () => {
    it('converts a Decimal to string', () => {
      expect(decimalTransformer.to(new Decimal('930.00'))).toBe('930');
      expect(decimalTransformer.to(new Decimal('925.85'))).toBe('925.85');
    });

    it('preserves null and undefined as null', () => {
      expect(decimalTransformer.to(null)).toBeNull();
      expect(decimalTransformer.to(undefined)).toBeNull();
    });
  });
});
