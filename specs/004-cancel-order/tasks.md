# Tareas 004 — Cancelar una orden

Una por vez y en orden. En las tareas **TDD**, primero el test en rojo. Un commit por tarea. Antes de cada commit: lint, tests y build.

- [x] **T1. Regla de cancelación (TDD).** `order-cancellation.ts`. Casos: `NEW` no lanza; `FILLED`, `REJECTED` y `CANCELLED` lanzan `ORDER_NOT_CANCELLABLE` con `kind` `CONFLICT`.
  Commit: `feat: add order cancellation rule`

- [x] **T2. Caso de uso y repositorio (TDD).** `findById` y `cancelIfNew` en el puerto y en el repositorio TypeORM, y `CancelOrderUseCase`. El puerto y su implementación van en el mismo commit para que el proyecto compile. Casos de uso: orden inexistente, orden no cancelable, cancelación correcta, carrera perdida. Casos de integración: `findById` existente e inexistente; `cancelIfNew` sobre una orden `NEW` insertada por el test; `cancelIfNew` sobre una orden no `NEW` devuelve `null` y no la modifica.
  Commit: `feat: add cancel order use case`

- [x] **T3. Endpoint (TDD).** `test/functional/cancel-order.spec.ts` con CA1 a CA10; luego el DTO de parámetro, el `PATCH` en el controller y el registro en `orders.module.ts`.
  Commit: `feat: add cancel order endpoint`

- [x] **T4. Ejemplos y verificación.** Agregar a `postman/cocos-challenge-backend.postman_collection.json` los ejemplos de cancelación (correcta, repetida, inexistente). Correr lint, las tres suites y el build. Cubre CA11.
  Commit: `docs: add cancel order http examples`