# Tareas 003 — Enviar una orden

Una por vez y en orden. En las tareas **TDD**, primero el test en rojo. Un commit por tarea.

- [x] **T1. Decisión de la orden (TDD).** `order.ts` y `order-decision.ts`. Un test por cada fila de R5 y por cada caso de CA1 a CA17, usando como movimientos las órdenes `FILLED` del usuario 1. Incluir los límites: 813 PAMP se acepta y 814 se rechaza; 40 PAMP se acepta y 41 se rechaza; `amount` 50000 da 54 acciones a mercado y 55 con límite 900; `amount` 500 da 0. `MARKET` sin precio lanza `MARKET_PRICE_UNAVAILABLE`.
  Commit: `feat: add order decision rules`

- [x] **T2. Caso de uso (TDD).** `findById` en el puerto de instrumentos, `submitAtomically` en el puerto de órdenes y `SubmitOrderUseCase` con repositorios falsos. Casos: `USER_NOT_FOUND`, `INSTRUMENT_NOT_FOUND`, `INSTRUMENT_NOT_TRADABLE`, `MARKET_PRICE_UNAVAILABLE` (sin llegar al puerto de órdenes en ninguno de los cuatro), orden aceptada y orden rechazada.
  Commit: `feat: add submit order use case`

- [x] **T3. Repositorio atómico (TDD).** Tests `*.int-spec.ts` y luego la implementación de `submitAtomically` y `findById`. Casos: inserta y devuelve la orden con su `id`; si `decide` lanza un error no queda ninguna fila; `datetime` se graba en UTC; dos llamadas simultáneas del mismo usuario se ejecutan una después de la otra (la segunda ve la orden de la primera).
  Commit: `feat: add atomic order submission`

- [ ] **T4. Endpoint (TDD).** `test/functional/orders.spec.ts` con CA1 a CA29; luego DTOs, controller y `src/composition/orders.module.ts`. Los casos que verifican el portfolio lo consultan por HTTP después de enviar la orden.
  Commit: `feat: add submit order endpoint`

- [ ] **T5. Ejemplos y verificación.** `http/orders.http` (MARKET por cantidad, MARKET por monto, LIMIT, orden rechazada, error de validación). Correr lint, las tres suites y el build. Cubre CA30.
  Commit: `docs: add orders http examples`