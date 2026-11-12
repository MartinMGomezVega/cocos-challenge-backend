import { Instrument } from '../../domain/instruments/instrument';

export const INSTRUMENT_REPOSITORY = Symbol('INSTRUMENT_REPOSITORY');

export interface SearchInstrumentsParams {
  query?: string;
  page: number;
  limit: number;
}

export interface SearchInstrumentsRepositoryResult {
  items: Instrument[];
  total: number;
}

export interface InstrumentRepository {
  search(
    params: SearchInstrumentsParams,
  ): Promise<SearchInstrumentsRepositoryResult>;
  findByIds(ids: readonly number[]): Promise<Instrument[]>;
}
