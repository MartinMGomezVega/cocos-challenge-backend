import { Money } from '../shared/money';
import { AccountMovement } from './account-movement';

export function calculateAvailableCash(
  movements: readonly AccountMovement[],
): Money {
  let cash = Money.zero();

  for (const movement of movements) {
    const amount = Money.from(movement.price).multiply(movement.size);
    if (movement.side === 'CASH_IN' || movement.side === 'SELL') {
      cash = cash.add(amount);
    } else {
      cash = cash.subtract(amount);
    }
  }

  return cash;
}
