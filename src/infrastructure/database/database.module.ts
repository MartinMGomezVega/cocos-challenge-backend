import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { shouldUseDatabaseSsl, validateEnv } from './env.validation';

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
  ],
})
export class DatabaseModule {}
