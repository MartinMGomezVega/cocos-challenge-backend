# Tareas 001 — Buscar activos

Una por vez y en orden. En las tareas **TDD**, primero el test en rojo. Un commit por tarea.

- [x] **T1. Base de test disponible.** `test/support/assert-database-reachable.ts` y su llamada desde el `globalSetup` de las suites funcional y de coverage. Verificar CA13 apuntando `DATABASE_URL` a un puerto local sin servicio (por ejemplo `localhost:5999`) y mostrar el mensaje.
  Commit: `chore: fail fast when test database is unreachable`

- [x] **T2. Formato de decimales (TDD).** `decimal-format.ts` con sus tests (half-up, empates que se alejan del cero, nunca `"-0.00"`). Refactor de `Money.toFixed2()` para delegar, con sus tests existentes en verde y sin modificarlos.
  Commit: `refactor: share two-decimal formatting`

- [ ] **T3. Dominio (TDD).** `MarketPrice` con `dailyReturn()` e `Instrument`. Casos: PAMP (925.85 y 921.80 → 0.44 al formatear), METR (−1.08), BMA (−1.15), `previousClose` `null`, `previousClose` 0.
  Commit: `feat: add instrument and market price domain`

- [ ] **T4. Caso de uso (TDD).** Puerto `InstrumentRepository` y `SearchInstrumentsUseCase` con un repositorio falso en memoria. Casos: `totalPages` con 65 y límite 20 (4), con total 0 (0), con división exacta, y que `query`, `page` y `limit` lleguen al puerto sin alterarse.
  Commit: `feat: add search instruments use case`

- [ ] **T5. Repositorio (TDD).** `typeorm-instrument.repository.int-spec.ts` contra la base de test y luego la implementación. Casos: coincidencia por ticker, por nombre, sin distinguir mayúsculas, exclusión de `MONEDA`, orden, paginado, total, comodines escapados (`%` y `_`), activos sin datos de mercado y uso de la fecha más reciente.
  Commit: `feat: add typeorm instrument repository`

- [ ] **T6. Endpoint (TDD).** `test/functional/instruments.spec.ts` con CA1 a CA12, luego DTOs, controller y `src/composition/instruments.module.ts`. Agregar `src/composition/` a `specs/architecture.md`.
  Commit: `feat: add search instruments endpoint`

- [ ] **T7. Ejemplos y verificación.** `http/instruments.http` con un pedido por cada caso relevante (búsqueda por ticker, por nombre, paginado, sin resultados, error 400). Correr lint, las tres suites y el build. Cubre CA14.
  Commit: `docs: add instruments http examples`