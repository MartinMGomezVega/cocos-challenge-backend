import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentEntity } from '../entities/instrument.entity';
import { MarketDataEntity } from '../entities/market-data.entity';
import { OrderEntity } from '../entities/order.entity';
import { UserEntity } from '../entities/user.entity';
import { shouldUseDatabaseSsl, validateEnv } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.getOrThrow<string>('DATABASE_URL');
        return {
          type: 'postgres',
          url,
          synchronize: false,
          autoLoadEntities: true,
          ssl: shouldUseDatabaseSsl(url)
            ? { rejectUnauthorized: false }
            : false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      InstrumentEntity,
      OrderEntity,
      MarketDataEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
