import { Decimal } from 'decimal.js';
import { AccountMovement } from '../portfolio/account-movement';
import { calculateAvailableCash } from '../portfolio/cash-calculator';
import { calculateHoldings } from '../portfolio/position-calculator';
import { DomainError } from '../shared/domain-error';
import { Money } from '../shared/money';
import { OrderSide, OrderType, RejectionReason } from './order';

export interface DecideOrderInput {
  readonly instrumentId: number;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly size?: number;
  readonly amount?: Decimal;
  readonly limitPrice?: Decimal;
  readonly marketPrice: Decimal | null;
  readonly movements: readonly AccountMovement[];
}

export interface OrderDecision {
  readonly size: number;
  readonly price: Decimal;
  readonly status: 'FILLED' | 'NEW' | 'REJECTED';
  readonly rejectionReason: RejectionReason | null;
}

const MAX_ORDER_SIZE = 2147483647;

export function decideOrder(input: DecideOrderInput): OrderDecision {
  let price: Decimal;
  if (input.type === 'MARKET') {
    if (input.marketPrice === null) {
      throw new DomainError(
        'MARKET_PRICE_UNAVAILABLE',
        'Market price is unavailable for this instrument',
        'UNPROCESSABLE',
      );
    }
    price = input.marketPrice;
  } else {
    if (input.limitPrice === undefined) {
      throw new DomainError(
        'MISSING_LIMIT_PRICE',
        'limitPrice is required for LIMIT orders',
        'VALIDATION',
      );
    }
    price = input.limitPrice;
  }

  let size: number;
  if (input.size !== undefined) {
    size = input.size;
  } else if (input.amount !== undefined) {
    size = input.amount.dividedBy(price).floor().toNumber();
  } else {
    throw new DomainError(
      'MISSING_ORDER_QUANTITY',
      'Either size or amount must be provided',
      'VALIDATION',
    );
  }

  if (size > MAX_ORDER_SIZE) {
    throw new DomainError(
      'ORDER_SIZE_TOO_LARGE',
      `Calculated order size exceeds maximum allowed (${MAX_ORDER_SIZE})`,
      'VALIDATION',
    );
  }

  if (size === 0) {
    return {
      size: 0,
      price,
      status: 'REJECTED',
      rejectionReason: 'AMOUNT_BELOW_PRICE',
    };
  }

  if (input.side === 'BUY') {
    const availableCash = calculateAvailableCash(input.movements);
    const totalCost = Money.from(price).multiply(size);
    if (totalCost.greaterThan(availableCash)) {
      return {
        size,
        price,
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_FUNDS',
      };
    }
  } else {
    const holdings = calculateHoldings(input.movements);
    const holding = holdings.find((h) => h.instrumentId === input.instrumentId);
    const currentQuantity = holding ? holding.quantity : 0;
    if (size > currentQuantity) {
      return {
        size,
        price,
        status: 'REJECTED',
        rejectionReason: 'INSUFFICIENT_SHARES',
      };
    }
  }

  return {
    size,
    price,
    status: input.type === 'MARKET' ? 'FILLED' : 'NEW',
    rejectionReason: null,
  };
}
