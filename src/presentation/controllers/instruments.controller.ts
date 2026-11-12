import { Controller, Get, Query } from '@nestjs/common';
import { SearchInstrumentsUseCase } from '../../application/use-cases/search-instruments.use-case';
import { SearchInstrumentsResponseDto } from '../dto/instrument.response.dto';
import { SearchInstrumentsQueryDto } from '../dto/search-instruments.query.dto';

@Controller('instruments')
export class InstrumentsController {
  constructor(
    private readonly searchInstrumentsUseCase: SearchInstrumentsUseCase,
  ) {}

  @Get()
  async search(
    @Query() queryDto: SearchInstrumentsQueryDto,
  ): Promise<SearchInstrumentsResponseDto> {
    const output = await this.searchInstrumentsUseCase.execute({
      query: queryDto.query,
      page: queryDto.page,
      limit: queryDto.limit,
    });

    return SearchInstrumentsResponseDto.fromOutput(output);
  }
}
