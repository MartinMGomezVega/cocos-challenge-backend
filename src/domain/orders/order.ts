import { Decimal } from 'decimal.js';

export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT';

export type OrderStatus = 'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED';

export type RejectionReason =
  'AMOUNT_BELOW_PRICE' | 'INSUFFICIENT_FUNDS' | 'INSUFFICIENT_SHARES';

export interface Order {
  readonly id: number;
  readonly userId: number;
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size: number;
  readonly price: Decimal;
  readonly status: OrderStatus;
  readonly rejectionReason: RejectionReason | null;
  readonly datetime: Date;
}
