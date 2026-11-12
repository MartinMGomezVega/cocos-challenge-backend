import { Decimal } from 'decimal.js';
import { toFixed2 } from '../shared/decimal-format';
import { Instrument, InstrumentType } from './instrument';
import { MarketPrice } from './market-price';

describe('MarketPrice', () => {
  it('calculates dailyReturn for PAMP (925.85 and 921.80 -> "0.44" when formatted)', () => {
    const mp = new MarketPrice(new Decimal('925.85'), new Decimal('921.80'));

    const ret = mp.dailyReturn();
    expect(ret).not.toBeNull();
    expect(toFixed2(ret!)).toBe('0.44');
  });

  it('calculates dailyReturn for METR (229.50 and 232.00 -> "-1.08" when formatted)', () => {
    const mp = new MarketPrice(new Decimal('229.50'), new Decimal('232.00'));

    const ret = mp.dailyReturn();
    expect(ret).not.toBeNull();
    expect(toFixed2(ret!)).toBe('-1.08');
  });

  it('calculates dailyReturn for BMA (1502.80 and 1520.25 -> "-1.15" when formatted)', () => {
    const mp = new MarketPrice(new Decimal('1502.80'), new Decimal('1520.25'));

    const ret = mp.dailyReturn();
    expect(ret).not.toBeNull();
    expect(toFixed2(ret!)).toBe('-1.15');
  });

  it('returns null when previousClose is null', () => {
    const mp = new MarketPrice(new Decimal('925.85'), null);

    expect(mp.dailyReturn()).toBeNull();
  });

  it('returns null when previousClose is 0', () => {
    const mp = new MarketPrice(new Decimal('925.85'), new Decimal(0));

    expect(mp.dailyReturn()).toBeNull();
  });
});

describe('Instrument', () => {
  it('stores readonly properties with marketPrice or null', () => {
    const mp = new MarketPrice(new Decimal('925.85'), new Decimal('921.80'));
    const type: InstrumentType = 'ACCIONES';
    const instrument = new Instrument(
      47,
      'PAMP',
      'Pampa Holding S.A.',
      type,
      mp,
    );

    expect(instrument.id).toBe(47);
    expect(instrument.ticker).toBe('PAMP');
    expect(instrument.name).toBe('Pampa Holding S.A.');
    expect(instrument.type).toBe('ACCIONES');
    expect(instrument.marketPrice).toBe(mp);

    const noMarketData = new Instrument(
      99,
      'NONE',
      'No Market Data S.A.',
      'ACCIONES',
      null,
    );
    expect(noMarketData.marketPrice).toBeNull();
  });
});
