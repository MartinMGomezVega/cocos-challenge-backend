import { Decimal } from 'decimal.js';
import { Instrument } from '../../domain/instruments/instrument';
import { MarketPrice } from '../../domain/instruments/market-price';
import {
  InstrumentRepository,
  SearchInstrumentsParams,
  SearchInstrumentsRepositoryResult,
} from '../ports/instrument.repository';
import { SearchInstrumentsUseCase } from './search-instruments.use-case';

class FakeInstrumentRepository implements InstrumentRepository {
  lastParams: SearchInstrumentsParams | null = null;
  private result: SearchInstrumentsRepositoryResult = { items: [], total: 0 };

  setResult(result: SearchInstrumentsRepositoryResult): void {
    this.result = result;
  }

  search(
    params: SearchInstrumentsParams,
  ): Promise<SearchInstrumentsRepositoryResult> {
    this.lastParams = params;
    return Promise.resolve(this.result);
  }

  findByIds(): Promise<Instrument[]> {
    return Promise.resolve([]);
  }

  findById(): Promise<Instrument | null> {
    return Promise.resolve(null);
  }
}

describe('SearchInstrumentsUseCase', () => {
  let repo: FakeInstrumentRepository;
  let useCase: SearchInstrumentsUseCase;

  beforeEach(() => {
    repo = new FakeInstrumentRepository();
    useCase = new SearchInstrumentsUseCase(repo);
  });

  it('calculates totalPages = 4 when total is 65 and limit is 20, passing params unaltered', async () => {
    const pamp = new Instrument(
      47,
      'PAMP',
      'Pampa Holding S.A.',
      'ACCIONES',
      new MarketPrice(new Decimal('925.85'), new Decimal('921.80')),
    );
    repo.setResult({ items: [pamp], total: 65 });

    const output = await useCase.execute({ query: 'pamp', page: 1, limit: 20 });

    expect(repo.lastParams).toEqual({ query: 'pamp', page: 1, limit: 20 });
    expect(output).toEqual({
      items: [pamp],
      page: 1,
      limit: 20,
      total: 65,
      totalPages: 4,
    });
  });

  it('calculates totalPages = 0 when total is 0', async () => {
    repo.setResult({ items: [], total: 0 });

    const output = await useCase.execute({
      query: 'zzzzzz',
      page: 1,
      limit: 20,
    });

    expect(repo.lastParams).toEqual({ query: 'zzzzzz', page: 1, limit: 20 });
    expect(output).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('calculates totalPages with exact division (e.g., total 40, limit 20 -> 2)', async () => {
    repo.setResult({ items: [], total: 40 });

    const output = await useCase.execute({ page: 2, limit: 20 });

    expect(repo.lastParams).toEqual({ page: 2, limit: 20 });
    expect(output.totalPages).toBe(2);
    expect(output.page).toBe(2);
    expect(output.limit).toBe(20);
  });
});
