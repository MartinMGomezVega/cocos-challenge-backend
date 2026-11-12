import { Decimal } from 'decimal.js';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../database/decimal.transformer';

@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instrumentid', type: 'integer', nullable: true })
  instrumentId!: number | null;

  @Column({ name: 'userid', type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ name: 'size', type: 'integer', nullable: true })
  size!: number | null;

  @Column({
    name: 'price',
    type: 'numeric',
    nullable: true,
    transformer: decimalTransformer,
  })
  price!: Decimal | null;

  @Column({ name: 'type', type: 'varchar', nullable: true })
  type!: string | null;

  @Column({ name: 'side', type: 'varchar', nullable: true })
  side!: string | null;

  @Column({ name: 'status', type: 'varchar', nullable: true })
  status!: string | null;

  @Column({ name: 'datetime', type: 'timestamp', nullable: true })
  datetime!: Date | null;
}
