import { SearchInstrumentsOutput } from '../../application/use-cases/search-instruments.use-case';
import {
  Instrument,
  InstrumentType,
} from '../../domain/instruments/instrument';
import { toFixed2 } from '../../domain/shared/decimal-format';

export class InstrumentItemResponseDto {
  id!: number;
  ticker!: string;
  name!: string;
  type!: InstrumentType;
  lastPrice!: string | null;
  dailyReturnPct!: string | null;

  static fromDomain(instrument: Instrument): InstrumentItemResponseDto {
    const dto = new InstrumentItemResponseDto();
    dto.id = instrument.id;
    dto.ticker = instrument.ticker;
    dto.name = instrument.name;
    dto.type = instrument.type;

    if (instrument.marketPrice === null) {
      dto.lastPrice = null;
      dto.dailyReturnPct = null;
    } else {
      dto.lastPrice = toFixed2(instrument.marketPrice.close);
      const dailyReturn = instrument.marketPrice.dailyReturn();
      dto.dailyReturnPct = dailyReturn === null ? null : toFixed2(dailyReturn);
    }

    return dto;
  }
}

export class PaginationMetaDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class SearchInstrumentsResponseDto {
  data!: InstrumentItemResponseDto[];
  meta!: PaginationMetaDto;

  static fromOutput(
    output: SearchInstrumentsOutput,
  ): SearchInstrumentsResponseDto {
    const dto = new SearchInstrumentsResponseDto();
    dto.data = output.items.map((item) =>
      InstrumentItemResponseDto.fromDomain(item),
    );
    dto.meta = {
      page: output.page,
      limit: output.limit,
      total: output.total,
      totalPages: output.totalPages,
    };
    return dto;
  }
}
