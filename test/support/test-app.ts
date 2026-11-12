import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/presentation/configure-app';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  await app.close();
}
