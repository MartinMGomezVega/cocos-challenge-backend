# Tareas 002 — Portfolio

Una por vez y en orden. En las tareas **TDD**, primero el test en rojo. Un commit por tarea.

- [x] **T1. Pesos disponibles (TDD).** `account-movement.ts` y `cash-calculator.ts`. Casos: los movimientos `FILLED` del usuario 1 dan 753000; un caso por cada `side`; lista vacía da 0; resultado negativo permitido.
  Commit: `feat: add available cash calculator`

- [x] **T2. Tenencias (TDD).** `position-calculator.ts`. Casos: usuario 1 (PAMP 40, METR 500, BMA −10); precio promedio ponderado (CA11); venta total excluye la posición; las transferencias no generan tenencia; sin compras el precio promedio es `null`.
  Commit: `feat: add holdings calculator`

- [x] **T3. Valuación (TDD).** `portfolio.ts`. Casos: usuario 1 completo (CA1 a CA4, total 889756); posición negativa con rendimiento `null`; instrumento sin precio (CA12); exclusión de `MONEDA`; orden por ticker; cuenta vacía.
  Commit: `feat: add portfolio valuation`

- [x] **T4. Caso de uso (TDD).** Puertos `UserRepository` y `OrderRepository`, `findByIds` en `InstrumentRepository`, y `GetPortfolioUseCase` con repositorios falsos. Casos: usuario inexistente lanza `USER_NOT_FOUND`; usuario sin órdenes; flujo completo.
  Commit: `feat: add get portfolio use case`

- [x] **T5. Repositorios (TDD).** Tests `*.int-spec.ts` y luego las implementaciones. Casos: `exists` verdadero y falso; el usuario 1 devuelve exactamente sus 7 movimientos `FILLED`; un usuario sin órdenes devuelve lista vacía; `findByIds` devuelve instrumentos con su último precio y, con lista vacía, no consulta la base.
  Commit: `feat: add portfolio repositories`

- [x] **T6. Endpoint (TDD).** `test/functional/portfolio.spec.ts` con CA1 a CA10 y `test/support/order-fixtures.ts`; luego DTOs, controller y `src/composition/portfolio.module.ts`.
  Commit: `feat: add portfolio endpoint`

- [x] **T7. Ejemplos y verificación.** `http/portfolio.http` (usuario con posiciones, usuario sin órdenes, usuario inexistente, id inválido). Correr lint, las tres suites y el build. Cubre CA13.
  Commit: `docs: add portfolio http examples`