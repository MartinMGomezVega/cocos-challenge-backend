import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'accountnumber', type: 'varchar', nullable: true })
  accountNumber!: string | null;
}
