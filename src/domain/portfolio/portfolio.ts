import { Decimal } from 'decimal.js';
import { Instrument } from '../instruments/instrument';
import { Money } from '../shared/money';
import { Holding } from './position-calculator';

export interface PortfolioPosition {
  readonly instrumentId: number;
  readonly ticker: string;
  readonly name: string;
  readonly quantity: number;
  readonly marketValue: Money | null;
  readonly totalReturnPct: Decimal | null;
  readonly dailyReturnPct: Decimal | null;
}

export interface Portfolio {
  readonly userId: number;
  readonly totalAccountValue: Money;
  readonly availableCash: Money;
  readonly positions: readonly PortfolioPosition[];
}

export interface BuildPortfolioParams {
  readonly userId: number;
  readonly availableCash: Money;
  readonly holdings: readonly Holding[];
  readonly instruments: readonly Instrument[];
}

export function buildPortfolio(params: BuildPortfolioParams): Portfolio {
  const instrumentById = new Map<number, Instrument>(
    params.instruments.map((inst) => [inst.id, inst]),
  );

  let totalAccountValue = params.availableCash;
  const positions: PortfolioPosition[] = [];

  for (const holding of params.holdings) {
    const instrument = instrumentById.get(holding.instrumentId);
    if (!instrument || instrument.type === 'MONEDA') {
      continue;
    }

    if (instrument.marketPrice === null) {
      positions.push({
        instrumentId: instrument.id,
        ticker: instrument.ticker,
        name: instrument.name,
        quantity: holding.quantity,
        marketValue: null,
        totalReturnPct: null,
        dailyReturnPct: null,
      });
      continue;
    }

    const { close } = instrument.marketPrice;
    const marketValue = Money.from(close).multiply(holding.quantity);
    totalAccountValue = totalAccountValue.add(marketValue);

    const totalReturnPct =
      holding.quantity > 0 &&
      holding.averageBuyPrice !== null &&
      holding.averageBuyPrice.gt(0)
        ? close
            .minus(holding.averageBuyPrice)
            .dividedBy(holding.averageBuyPrice)
            .times(100)
        : null;

    positions.push({
      instrumentId: instrument.id,
      ticker: instrument.ticker,
      name: instrument.name,
      quantity: holding.quantity,
      marketValue,
      totalReturnPct,
      dailyReturnPct: instrument.marketPrice.dailyReturn(),
    });
  }

  positions.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    userId: params.userId,
    totalAccountValue,
    availableCash: params.availableCash,
    positions,
  };
}
