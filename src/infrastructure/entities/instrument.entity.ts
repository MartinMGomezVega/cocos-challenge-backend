import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'instruments' })
export class InstrumentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'ticker', type: 'varchar', nullable: true })
  ticker!: string | null;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ name: 'type', type: 'varchar', nullable: true })
  type!: string | null;
}
