import { AccountMovement } from '../../domain/portfolio/account-movement';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepository {
  findFilledMovementsByUser(userId: number): Promise<AccountMovement[]>;
}
