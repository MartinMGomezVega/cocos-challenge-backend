import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import {
  OrderRepository,
  PendingOrderDecision,
} from '../../application/ports/order.repository';
import {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../domain/orders/order';
import {
  AccountMovement,
  MovementSide,
} from '../../domain/portfolio/account-movement';
import { DomainError } from '../../domain/shared/domain-error';
import { OrderEntity } from '../entities/order.entity';
import { UserEntity } from '../entities/user.entity';

interface RawInsertedOrderRow {
  id: number;
  datetime_iso: string;
}

interface RawOrderRow {
  id: number;
  userid: number;
  instrumentid: number;
  side: OrderSide;
  type: OrderType;
  size: number;
  price: string;
  status: OrderStatus;
  datetime_iso: string;
}

function mapRawOrderRow(row: RawOrderRow): Order {
  return {
    id: row.id,
    userId: row.userid,
    instrumentId: row.instrumentid,
    side: row.side,
    type: row.type,
    size: row.size,
    price: new Decimal(row.price),
    status: row.status,
    rejectionReason: null,
    datetime: new Date(row.datetime_iso),
  };
}

async function queryFilledMovements(
  orderRepository: Repository<OrderEntity>,
  userId: number,
): Promise<AccountMovement[]> {
  const rows = await orderRepository.find({
    select: {
      id: true,
      instrumentId: true,
      side: true,
      size: true,
      price: true,
    },
    where: {
      userId,
      status: 'FILLED',
      instrumentId: Not(IsNull()),
      side: Not(IsNull()),
      size: Not(IsNull()),
      price: Not(IsNull()),
    },
    order: { id: 'ASC' },
  });

  return rows.map((row) => ({
    instrumentId: row.instrumentId!,
    side: row.side as MovementSide,
    size: row.size!,
    price: row.price!,
  }));
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async findFilledMovementsByUser(userId: number): Promise<AccountMovement[]> {
    return queryFilledMovements(this.orderRepository, userId);
  }

  async submitAtomically(
    userId: number,
    decide: (
      movements: AccountMovement[],
    ) => PendingOrderDecision | Promise<PendingOrderDecision>,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(UserEntity, {
        select: { id: true },
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new DomainError(
          'USER_NOT_FOUND',
          `User ${userId} was not found`,
          'NOT_FOUND',
        );
      }

      const movements = await queryFilledMovements(
        manager.getRepository(OrderEntity),
        userId,
      );
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

  async findById(orderId: number): Promise<Order | null> {
    const rows = await this.dataSource.query<RawOrderRow[]>(
      `SELECT id, userid, instrumentid, side, type, size, price, status,
              to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS datetime_iso
       FROM orders
       WHERE id = $1`,
      [orderId],
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRawOrderRow(rows[0]);
  }

  async cancelIfNew(orderId: number): Promise<Order | null> {
    const [rows] = await this.dataSource.query<[RawOrderRow[], number]>(
      `UPDATE orders
       SET status = 'CANCELLED'
       WHERE id = $1 AND status = 'NEW'
       RETURNING id, userid, instrumentid, side, type, size, price, status,
                 to_char(datetime, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS datetime_iso`,
      [orderId],
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRawOrderRow(rows[0]);
  }
}
