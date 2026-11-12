import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { DataSource, IsNull, Repository } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { InstrumentEntity } from './instrument.entity';
import { MarketDataEntity } from './market-data.entity';
import { OrderEntity } from './order.entity';
import { UserEntity } from './user.entity';

describe('Database Entities (CA3-CA6)', () => {
  let moduleRef: TestingModule;
  let userRepo: Repository<UserEntity>;
  let instrumentRepo: Repository<InstrumentEntity>;
  let orderRepo: Repository<OrderEntity>;
  let marketDataRepo: Repository<MarketDataEntity>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        TypeOrmModule.forFeature([
          UserEntity,
          InstrumentEntity,
          OrderEntity,
          MarketDataEntity,
        ]),
      ],
    }).compile();

    userRepo = moduleRef.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    instrumentRepo = moduleRef.get<Repository<InstrumentEntity>>(
      getRepositoryToken(InstrumentEntity),
    );
    orderRepo = moduleRef.get<Repository<OrderEntity>>(
      getRepositoryToken(OrderEntity),
    );
    marketDataRepo = moduleRef.get<Repository<MarketDataEntity>>(
      getRepositoryToken(MarketDataEntity),
    );
  });

  afterAll(async () => {
    if (moduleRef) {
      const dataSource = moduleRef.get(DataSource);
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await moduleRef.close();
    }
  });

  it('CA3: reads 4 users, 66 instruments, 11 orders and 126 marketdata rows', async () => {
    await expect(userRepo.count()).resolves.toBe(4);
    await expect(instrumentRepo.count()).resolves.toBe(66);
    await expect(orderRepo.count()).resolves.toBe(11);
    await expect(marketDataRepo.count()).resolves.toBe(126);
  });

  it('CA4: reads order 2 with instrumentId = 47, userId = 1, size = 50 and price = Decimal(930)', async () => {
    const order = await orderRepo.findOneByOrFail({ id: 2 });

    expect(order.instrumentId).toBe(47);
    expect(order.userId).toBe(1);
    expect(order.size).toBe(50);
    expect(Decimal.isDecimal(order.price)).toBe(true);
    expect(order.price).toEqual(new Decimal(930));
  });

  it('CA5: reads marketdata for instrument 47 on 2023-07-14 with close = 925.85 and previousClose = 921.80', async () => {
    const row = await marketDataRepo.findOneByOrFail({
      instrumentId: 47,
      date: '2023-07-14',
    });

    expect(Decimal.isDecimal(row.close)).toBe(true);
    expect(row.close).toEqual(new Decimal('925.85'));
    expect(Decimal.isDecimal(row.previousClose)).toBe(true);
    expect(row.previousClose).toEqual(new Decimal('921.80'));
  });

  it('CA6: reads a marketdata row with NULL high as high = null without error', async () => {
    const row = await marketDataRepo.findOneByOrFail({
      instrumentId: 12,
      date: '2023-07-13',
      high: IsNull(),
    });

    expect(row.high).toBeNull();
    expect(row.low).toBeNull();
    expect(row.open).toBeNull();
    expect(row.close).toEqual(new Decimal('20.50'));
  });
});
