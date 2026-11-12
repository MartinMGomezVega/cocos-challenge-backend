import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRepository } from '../../application/ports/user.repository';

interface RawExistsRow {
  exists: boolean;
}

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async exists(userId: number): Promise<boolean> {
    const rows = await this.dataSource.query<RawExistsRow[]>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1) AS exists`,
      [userId],
    );
    return rows[0].exists;
  }
}
