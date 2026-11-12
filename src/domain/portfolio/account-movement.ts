import { Decimal } from 'decimal.js';

export type MovementSide = 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT';

export interface AccountMovement {
  readonly instrumentId: number;
  readonly side: MovementSide;
  readonly size: number;
  readonly price: Decimal;
}
