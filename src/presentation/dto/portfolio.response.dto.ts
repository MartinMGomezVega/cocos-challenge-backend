import { Portfolio, PortfolioPosition } from '../../domain/portfolio/portfolio';
import { toFixed2 } from '../../domain/shared/decimal-format';

export class PortfolioPositionResponseDto {
  instrumentId!: number;
  ticker!: string;
  name!: string;
  quantity!: number;
  marketValue!: string | null;
  totalReturnPct!: string | null;
  dailyReturnPct!: string | null;

  static fromDomain(position: PortfolioPosition): PortfolioPositionResponseDto {
    const dto = new PortfolioPositionResponseDto();
    dto.instrumentId = position.instrumentId;
    dto.ticker = position.ticker;
    dto.name = position.name;
    dto.quantity = position.quantity;
    dto.marketValue =
      position.marketValue === null ? null : position.marketValue.toFixed2();
    dto.totalReturnPct =
      position.totalReturnPct === null
        ? null
        : toFixed2(position.totalReturnPct);
    dto.dailyReturnPct =
      position.dailyReturnPct === null
        ? null
        : toFixed2(position.dailyReturnPct);
    return dto;
  }
}

export class PortfolioResponseDto {
  userId!: number;
  totalAccountValue!: string;
  availableCash!: string;
  positions!: PortfolioPositionResponseDto[];

  static fromDomain(portfolio: Portfolio): PortfolioResponseDto {
    const dto = new PortfolioResponseDto();
    dto.userId = portfolio.userId;
    dto.totalAccountValue = portfolio.totalAccountValue.toFixed2();
    dto.availableCash = portfolio.availableCash.toFixed2();
    dto.positions = portfolio.positions.map((pos) =>
      PortfolioPositionResponseDto.fromDomain(pos),
    );
    return dto;
  }
}
