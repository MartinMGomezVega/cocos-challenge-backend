import { Decimal } from 'decimal.js';
import { ValueTransformer } from 'typeorm';

export const decimalTransformer = {
  from: (value: string | null | undefined): Decimal | null =>
    value === null || value === undefined ? null : new Decimal(value),
  to: (value: Decimal | null | undefined): string | null =>
    value === null || value === undefined ? null : value.toString(),
} satisfies ValueTransformer;
