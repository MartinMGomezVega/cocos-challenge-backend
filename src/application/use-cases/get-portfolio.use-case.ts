import { calculateAvailableCash } from '../../domain/portfolio/cash-calculator';
import { buildPortfolio, Portfolio } from '../../domain/portfolio/portfolio';
import { calculateHoldings } from '../../domain/portfolio/position-calculator';
import { DomainError } from '../../domain/shared/domain-error';
import { InstrumentRepository } from '../ports/instrument.repository';
import { OrderRepository } from '../ports/order.repository';
import { UserRepository } from '../ports/user.repository';

export class GetPortfolioUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly orderRepository: OrderRepository,
    private readonly instrumentRepository: InstrumentRepository,
  ) {}

  async execute(userId: number): Promise<Portfolio> {
    const userExists = await this.userRepository.exists(userId);
    if (!userExists) {
      throw new DomainError(
        'USER_NOT_FOUND',
        `User ${userId} was not found`,
        'NOT_FOUND',
      );
    }

    const movements =
      await this.orderRepository.findFilledMovementsByUser(userId);
    const availableCash = calculateAvailableCash(movements);
    const holdings = calculateHoldings(movements);

    const instruments =
      holdings.length === 0
        ? []
        : await this.instrumentRepository.findByIds(
            holdings.map((holding) => holding.instrumentId),
          );

    return buildPortfolio({
      userId,
      availableCash,
      holdings,
      instruments,
    });
  }
}
