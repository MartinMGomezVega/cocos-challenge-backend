import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { DataSource } from 'typeorm';
import {
  InstrumentRepository,
  SearchInstrumentsParams,
  SearchInstrumentsRepositoryResult,
} from '../../application/ports/instrument.repository';
import {
  Instrument,
  InstrumentType,
} from '../../domain/instruments/instrument';
import { MarketPrice } from '../../domain/instruments/market-price';

interface RawInstrumentRow {
  id: number;
  ticker: string;
  name: string;
  type: InstrumentType;
  close: string | null;
  previousclose: string | null;
}

interface RawCountRow {
  total: string;
}

const SELECT_INSTRUMENTS_WITH_LATEST_MARKET_DATA = `
  SELECT
    i.id,
    i.ticker,
    i.name,
    i.type,
    m.close,
    m.previousclose
  FROM instruments i
  LEFT JOIN LATERAL (
    SELECT md.close, md.previousclose
    FROM marketdata md
    WHERE md.instrumentid = i.id
    ORDER BY md.date DESC, md.id DESC
    LIMIT 1
  ) m ON TRUE
`;

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

function mapRowToInstrument(row: RawInstrumentRow): Instrument {
  const marketPrice =
    row.close !== null
      ? new MarketPrice(
          new Decimal(row.close),
          row.previousclose !== null ? new Decimal(row.previousclose) : null,
        )
      : null;

  return new Instrument(row.id, row.ticker, row.name, row.type, marketPrice);
}

@Injectable()
export class TypeOrmInstrumentRepository implements InstrumentRepository {
  constructor(private readonly dataSource: DataSource) {}

  async search(
    params: SearchInstrumentsParams,
  ): Promise<SearchInstrumentsRepositoryResult> {
    const trimmedQuery = params.query?.trim();
    const hasQuery = Boolean(trimmedQuery && trimmedQuery.length > 0);
    const pattern = hasQuery ? `%${escapeLikePattern(trimmedQuery!)}%` : null;
    const offset = (params.page - 1) * params.limit;

    const whereClause = hasQuery
      ? `i.type <> 'MONEDA' AND (i.ticker ILIKE $1 ESCAPE '\\' OR i.name ILIKE $1 ESCAPE '\\')`
      : `i.type <> 'MONEDA'`;

    const countParams = hasQuery ? [pattern] : [];
    const dataParams = hasQuery
      ? [pattern, params.limit, offset]
      : [params.limit, offset];
    const limitPlaceholder = hasQuery ? '$2' : '$1';
    const offsetPlaceholder = hasQuery ? '$3' : '$2';

    const countSql = `
      SELECT COUNT(*)::text AS total
      FROM instruments i
      WHERE ${whereClause}
    `;

    const dataSql = `
      ${SELECT_INSTRUMENTS_WITH_LATEST_MARKET_DATA}
      WHERE ${whereClause}
      ORDER BY i.ticker ASC, i.id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const [countRows, dataRows] = await Promise.all([
      this.dataSource.query<RawCountRow[]>(countSql, countParams),
      this.dataSource.query<RawInstrumentRow[]>(dataSql, dataParams),
    ]);

    const total = Number(countRows[0].total);
    const items = dataRows.map(mapRowToInstrument);

    return { items, total };
  }

  async findByIds(ids: readonly number[]): Promise<Instrument[]> {
    if (ids.length === 0) {
      return [];
    }

    const sql = `
      ${SELECT_INSTRUMENTS_WITH_LATEST_MARKET_DATA}
      WHERE i.id = ANY($1::int[])
      ORDER BY i.ticker ASC, i.id ASC
    `;

    const rows = await this.dataSource.query<RawInstrumentRow[]>(sql, [ids]);
    return rows.map(mapRowToInstrument);
  }

  async findById(id: number): Promise<Instrument | null> {
    const sql = `
      ${SELECT_INSTRUMENTS_WITH_LATEST_MARKET_DATA}
      WHERE i.id = $1
    `;

    const rows = await this.dataSource.query<RawInstrumentRow[]>(sql, [id]);
    return rows.length > 0 ? mapRowToInstrument(rows[0]) : null;
  }
}
