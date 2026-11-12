import { Decimal } from 'decimal.js';

export function toFixed2(value: Decimal): string {
  const formatted = value.toFixed(2, Decimal.ROUND_HALF_UP);
  return formatted === '-0.00' ? '0.00' : formatted;
}
