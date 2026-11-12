import { Instrument } from '../../domain/instruments/instrument';
import {
  InstrumentRepository,
  SearchInstrumentsParams,
} from '../ports/instrument.repository';

export type SearchInstrumentsInput = SearchInstrumentsParams;

export interface SearchInstrumentsOutput {
  items: Instrument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class SearchInstrumentsUseCase {
  constructor(private readonly instrumentRepository: InstrumentRepository) {}

  async execute(
    input: SearchInstrumentsInput,
  ): Promise<SearchInstrumentsOutput> {
    const { items, total } = await this.instrumentRepository.search(input);
    const totalPages = total === 0 ? 0 : Math.ceil(total / input.limit);

    return {
      items,
      page: input.page,
      limit: input.limit,
      total,
      totalPages,
    };
  }
}
