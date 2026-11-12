import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { DataSource } from 'typeorm';
import { OrderRepository } from '../../application/ports/order.repository';
import {
  AccountMovement,
  MovementSide,
} from '../../domain/portfolio/account-movement';

interface RawOrderMovementRow {
  instrumentid: number;
  side: MovementSide;
  size: number;
  price: string;
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findFilledMovementsByUser(userId: number): Promise<AccountMovement[]> {
    const rows = await this.dataSource.query<RawOrderMovementRow[]>(
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
}
