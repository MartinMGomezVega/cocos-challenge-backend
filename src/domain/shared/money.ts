import { Decimal } from 'decimal.js';

const NUMERIC_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value;
  }

  static from(value: string | number | Decimal): Money {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value)) {
        throw new Error(
          `Invalid Money number value: "${String(value)}". Only safe integers are allowed.`,
        );
      }
      return new Money(new Decimal(value));
    }

    if (typeof value === 'string') {
      if (!NUMERIC_STRING_PATTERN.test(value)) {
        throw new Error(`Invalid Money string value: "${value}".`);
      }
      return new Money(new Decimal(value));
    }

    if (Decimal.isDecimal(value) && value.isFinite()) {
      return new Money(value);
    }

    throw new Error(`Invalid Money value: "${String(value)}".`);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor)) {
      throw new Error(
        `Invalid multiplication factor: "${String(factor)}". Only safe integers are allowed.`,
      );
    }
    return new Money(this.value.times(factor));
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.value.greaterThanOrEqualTo(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  toDecimal(): Decimal {
    return this.value;
  }

  toFixed2(): string {
    const formatted = this.value.toFixed(2, Decimal.ROUND_HALF_UP);
    return formatted === '-0.00' ? '0.00' : formatted;
  }
}
