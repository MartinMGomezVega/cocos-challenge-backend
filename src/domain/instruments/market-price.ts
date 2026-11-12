import { Decimal } from 'decimal.js';

export class MarketPrice {
  readonly close: Decimal;
  readonly previousClose: Decimal | null;

  constructor(close: Decimal, previousClose: Decimal | null) {
    this.close = close;
    this.previousClose = previousClose;
  }

  dailyReturn(): Decimal | null {
    if (this.previousClose === null || this.previousClose.isZero()) {
      return null;
    }

    return this.close
      .minus(this.previousClose)
      .dividedBy(this.previousClose)
      .times(100);
  }
}
