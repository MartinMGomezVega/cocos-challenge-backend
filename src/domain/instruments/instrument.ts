import { MarketPrice } from './market-price';

export type InstrumentType = 'ACCIONES' | 'MONEDA';

export class Instrument {
  readonly id: number;
  readonly ticker: string;
  readonly name: string;
  readonly type: InstrumentType;
  readonly marketPrice: MarketPrice | null;

  constructor(
    id: number,
    ticker: string,
    name: string,
    type: InstrumentType,
    marketPrice: MarketPrice | null,
  ) {
    this.id = id;
    this.ticker = ticker;
    this.name = name;
    this.type = type;
    this.marketPrice = marketPrice;
  }
}
