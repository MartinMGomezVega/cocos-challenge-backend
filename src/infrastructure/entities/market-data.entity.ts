import { Decimal } from 'decimal.js';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../database/decimal.transformer';

@Entity({ name: 'marketdata' })
export class MarketDataEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instrumentid', type: 'integer', nullable: true })
  instrumentId!: number | null;

  @Column({
    name: 'high',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  high!: Decimal | null;

  @Column({
    name: 'low',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  low!: Decimal | null;

  @Column({
    name: 'open',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  open!: Decimal | null;

  @Column({
    name: 'close',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  close!: Decimal | null;

  @Column({
    name: 'previousclose',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  previousClose!: Decimal | null;

  @Column({ name: 'date', type: 'date', nullable: true })
  date!: string | null;
}
