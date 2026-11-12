# Plan 001 — Buscar activos

Cómo se implementa `spec.md`. Respeta `specs/architecture.md`. No agrega dependencias.

## Archivos

```
src/domain/shared/decimal-format.ts          # toFixed2(decimal): half-up, sin "-0.00"
src/domain/instruments/market-price.ts       # close, previousClose, dailyReturn()
src/domain/instruments/instrument.ts         # id, ticker, name, type, marketPrice | null
src/application/ports/instrument.repository.ts
src/application/use-cases/search-instruments.use-case.ts
src/infrastructure/repositories/typeorm-instrument.repository.ts
src/presentation/dto/search-instruments.query.dto.ts
src/presentation/dto/instrument.response.dto.ts
src/presentation/controllers/instruments.controller.ts
src/composition/instruments.module.ts        # cableado NestJS de la funcionalidad
test/support/assert-database-reachable.ts
test/support/global-setup-db.ts
test/functional/instruments.spec.ts
http/instruments.http
```

## Decisiones técnicas

- **Formato de decimales:** `decimal-format.ts` concentra el redondeo a 2 decimales. `Money.toFixed2()` pasa a delegar en esa función, sin cambiar su comportamiento ni sus tests.
- **Retorno diario:** `MarketPrice.dailyReturn()` devuelve un `Decimal` o `null`. No formatea; el formato se aplica en el DTO de respuesta.
- **Puerto:** `InstrumentRepository.search({ query, page, limit })` devuelve `{ items: Instrument[], total: number }`. El caso de uso calcula `totalPages` y arma el resultado paginado.
- **Consulta:** una sola consulta SQL parametrizada que trae los instrumentos con su fila más reciente de `marketdata` (por ejemplo con `LEFT JOIN LATERAL ... ORDER BY date DESC LIMIT 1`), filtra `type <> 'MONEDA'`, aplica `ILIKE` con los comodines escapados, ordena y pagina. El total sale de un `COUNT` con el mismo filtro. Nunca se concatena el texto del usuario en el SQL.
- **Entidades:** el repositorio convierte filas en objetos de dominio (si en la base `close` viniera `null`, el repositorio devuelve `marketPrice: null`). Las entidades TypeORM no salen de `infrastructure`.
- **Validación de entrada:** DTO con `class-validator` y `class-transformer` (`@Type(() => Number)` para `page` y `limit`). Los parámetros desconocidos los rechaza el `ValidationPipe` global.
- **Cableado:** nueva carpeta `src/composition/` para los módulos de NestJS que conectan puerto, repositorio, caso de uso y controller. Se agrega a `specs/architecture.md`. `*.module.ts` sigue excluido del coverage.
- **Base de test disponible:** `assertDatabaseReachable(url)` intenta una conexión con `pg` y un tiempo máximo de 3 segundos. Se llama desde `test/support/global-setup-db.ts` (configurado como `globalSetup` de la suite funcional y de la de coverage), después de la guardia de Neon. La suite unitaria sigue usando `test/support/global-setup.ts` y no la llama.

## Niveles de test

| Nivel | Archivo | Qué prueba |
|---|---|---|
| Dominio | `decimal-format.spec.ts`, `market-price.spec.ts` | Redondeo y retorno diario, incluidos los casos `null` |
| Caso de uso | `search-instruments.use-case.spec.ts` | Paginado y `totalPages` con un repositorio falso en memoria |
| Infraestructura | `typeorm-instrument.repository.int-spec.ts` | La consulta SQL contra la base de test |
| Funcional | `test/functional/instruments.spec.ts` | CA1 a CA12 por HTTP |