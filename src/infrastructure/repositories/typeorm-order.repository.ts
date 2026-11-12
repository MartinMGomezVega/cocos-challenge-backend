import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { DataSource, EntityManager } from 'typeorm';
import {
  OrderRepository,
  PendingOrderDecision,
} from '../../application/ports/order.repository';
import { Order } from '../../domain/orders/order';
import {
  AccountMovement,
  MovementSide,
} from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';

interface RawOrderMovementRow {
  instrumentid: number;
  side: MovementSide;
  size: number;
  price: string;
}

interface RawUserIdRow {
  id: number;
}

interface RawInsertedOrderRow {
  id: number;
  datetime_iso: string;
}

async function queryFilledMovements(
  executor: DataSource | EntityManager,
  userId: number,
): Promise<AccountMovement[]> {
  const rows = await executor.query<RawOrderMovementRow[]>(
    `SELECT instrumentid, side, size, price
     FROM orders
     WHERE userid = $1
       AND status = 'FILLED'
       AND instrumentid IS NOT NULL
       AND side IS NOT NULL
       AND size IS NOT NULL
       AND price IS NOT NULL
     ORDER BY id ASC`,
    [userId],
  );

  return rows.map((row) => ({
    instrumentId: row.instrumentid,
    side: row.side,
    size: row.size,
    price: new Decimal(row.price),
  }));
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findFilledMovementsByUser(userId: number): Promise<AccountMovement[]> {
    return queryFilledMovements(this.dataSource, userId);
  }

  async submitAtomically(
    userId: number,
    decide: (
      movements: AccountMovement[],
    ) => PendingOrderDecision | Promise<PendingOrderDecision>,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const userRows = await manager.query<RawUserIdRow[]>(
        `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      );
      if (userRows.length === 0) {
        throw new DomainError(
          'USER_NOT_FOUND',
          `User ${userId} was not found`,
          'NOT_FOUND',
        );
      }

      const movements = await queryFilledMovements(manager, userId);
      const decision = await decide(movements);

      const insertedRows = await manager.query<RawInsertedOrderRow[]>(
        `INSERT INTO orders (instrumentid, userid, size, price, type, side, status, datetime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, timezone('utc', clock_timestamp()))
         RETURNING id, to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS datetime_iso`,
        [
          decision.instrumentId,
          userId,
          decision.size,
          decision.price.toFixed(2),
          decision.type,
          decision.side,
          decision.status,
        ],
      );

      return {
        id: insertedRows[0].id,
        userId,
        instrumentId: decision.instrumentId,
        side: decision.side,
        type: decision.type,
        size: decision.size,
        price: decision.price,
        status: decision.status,
        rejectionReason: decision.rejectionReason,
        datetime: new Date(insertedRows[0].datetime_iso),
      };
    });
  }
}
