import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmUserRepository } from './typeorm-user.repository';

describe('TypeOrmUserRepository (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let repository: TypeOrmUserRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [TypeOrmUserRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    repository = moduleRef.get(TypeOrmUserRepository);
  });

  afterAll(async () => {
    if (moduleRef) {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await moduleRef.close();
    }
  });

  it('returns true when user exists (e.g. user 1)', async () => {
    await expect(repository.exists(1)).resolves.toBe(true);
  });

  it('returns false when user does not exist (e.g. user 999)', async () => {
    await expect(repository.exists(999)).resolves.toBe(false);
  });
});
