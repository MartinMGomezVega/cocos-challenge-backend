import { DataSource } from 'typeorm';

export interface TestOrderInput {
  userId: number;
  instrumentId: number;
  size: number;
  price: string;
  type?: 'MARKET' | 'LIMIT';
  side: 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT';
  status?: 'FILLED' | 'NEW' | 'REJECTED' | 'CANCELLED';
}

export async function insertTestOrders(
  dataSource: DataSource,
  orders: readonly TestOrderInput[],
): Promise<void> {
  for (const order of orders) {
    await dataSource.query(
      `INSERT INTO orders (instrumentid, userid, size, price, type, side, status, datetime)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        order.instrumentId,
        order.userId,
        order.size,
        order.price,
        order.type ?? 'MARKET',
        order.side,
        order.status ?? 'FILLED',
      ],
    );
  }
}

export async function cleanupTestOrders(dataSource: DataSource): Promise<void> {
  await dataSource.query(`DELETE FROM orders WHERE id > 11`);
  await dataSource.query(
    `SELECT setval(pg_get_serial_sequence('orders', 'id'), 11, true)`,
  );
}
