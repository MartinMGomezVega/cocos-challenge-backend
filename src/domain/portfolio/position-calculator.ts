import { Decimal } from 'decimal.js';
import { AccountMovement } from './account-movement';

export interface Holding {
  readonly instrumentId: number;
  readonly quantity: number;
  readonly averageBuyPrice: Decimal | null;
}

interface HoldingAccumulator {
  quantity: number;
  buyQuantity: number;
  buyCost: Decimal;
}

export function calculateHoldings(
  movements: readonly AccountMovement[],
): Holding[] {
  const byInstrument = new Map<number, HoldingAccumulator>();

  for (const movement of movements) {
    if (movement.side !== 'BUY' && movement.side !== 'SELL') {
      continue;
    }

    let acc = byInstrument.get(movement.instrumentId);
    if (!acc) {
      acc = {
        quantity: 0,
        buyQuantity: 0,
        buyCost: new Decimal(0),
      };
      byInstrument.set(movement.instrumentId, acc);
    }

    if (movement.side === 'BUY') {
      acc.quantity += movement.size;
      acc.buyQuantity += movement.size;
      acc.buyCost = acc.buyCost.plus(movement.price.times(movement.size));
    } else {
      acc.quantity -= movement.size;
    }
  }

  const holdings: Holding[] = [];
  for (const [instrumentId, acc] of byInstrument.entries()) {
    if (acc.quantity === 0) {
      continue;
    }

    const averageBuyPrice =
      acc.buyQuantity > 0 ? acc.buyCost.dividedBy(acc.buyQuantity) : null;

    holdings.push({
      instrumentId,
      quantity: acc.quantity,
      averageBuyPrice,
    });
  }

  return holdings;
}
