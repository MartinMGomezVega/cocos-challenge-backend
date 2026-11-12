import { Controller, Get, Param } from '@nestjs/common';
import { GetPortfolioUseCase } from '../../application/use-cases/get-portfolio.use-case';
import { PortfolioResponseDto } from '../dto/portfolio.response.dto';
import { UserIdParamDto } from '../dto/user-id.param.dto';

@Controller('users')
export class PortfolioController {
  constructor(private readonly getPortfolioUseCase: GetPortfolioUseCase) {}

  @Get(':userId/portfolio')
  async getPortfolio(
    @Param() params: UserIdParamDto,
  ): Promise<PortfolioResponseDto> {
    const portfolio = await this.getPortfolioUseCase.execute(params.userId);
    return PortfolioResponseDto.fromDomain(portfolio);
  }
}
