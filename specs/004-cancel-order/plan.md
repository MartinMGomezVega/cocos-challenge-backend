# Plan 004 — Cancelar una orden

Cómo se implementa `spec.md`. Respeta `specs/architecture.md`. No agrega dependencias.

## Archivos

```
src/domain/orders/order-cancellation.ts      # assertCancellable(order)
src/application/ports/order.repository.ts    # se agregan findById y cancelIfNew
src/application/use-cases/cancel-order.use-case.ts
src/infrastructure/repositories/typeorm-order.repository.ts   # se agregan findById y cancelIfNew
src/presentation/dto/order-id.param.dto.ts
src/presentation/controllers/orders.controller.ts             # se agrega el PATCH
src/composition/orders.module.ts                              # se registra el caso de uso
test/functional/cancel-order.spec.ts
http/orders.http                                              # se agregan ejemplos
```

## Decisiones técnicas

- **Regla en el dominio:** `assertCancellable(order)` lanza `DomainError` `CONFLICT` con código `ORDER_NOT_CANCELLABLE` si el estado no es `NEW`. Es la única fuente de la regla para el mensaje y el código de error.
- **Caso de uso:**
  1. `findById`; si no existe, `DomainError` `NOT_FOUND` con código `ORDER_NOT_FOUND`.
  2. `assertCancellable(order)`.
  3. `cancelIfNew(orderId)`; si devuelve `null`, otra cancelación ganó la carrera: lanza `ORDER_NOT_CANCELLABLE`.
- **Actualización atómica:** `cancelIfNew` ejecuta una sola sentencia, `UPDATE orders SET status = 'CANCELLED' WHERE id = $1 AND status = 'NEW' RETURNING ...`. La condición sobre `status` en el propio `UPDATE` garantiza R3 sin bloqueos explícitos: si dos pedidos llegan juntos, solo uno modifica la fila.
- **Respuesta:** se reutiliza `order.response.dto.ts` de la fase 003, con `rejectionReason` en `null`.
- **Errores:** `ORDER_NOT_FOUND` es `NOT_FOUND` (404); `ORDER_NOT_CANCELLABLE` es `CONFLICT` (409).

## Niveles de test

| Nivel | Archivo | Qué prueba |
|---|---|---|
| Dominio | `order-cancellation.spec.ts` | `NEW` pasa; `FILLED`, `REJECTED` y `CANCELLED` lanzan `ORDER_NOT_CANCELLABLE` |
| Caso de uso | `cancel-order.use-case.spec.ts` | Orden inexistente, orden no cancelable, cancelación correcta y carrera perdida (`cancelIfNew` devuelve `null`) |
| Infraestructura | `typeorm-order.repository.int-spec.ts` | `findById` y `cancelIfNew` contra la base, incluido que una orden no `NEW` no se modifica |
| Funcional | `test/functional/cancel-order.spec.ts` | CA1 a CA10 por HTTP |

## Consideraciones para producción

Sin autenticación, cualquier cliente puede cancelar cualquier orden conociendo su `id`. Con autenticación, el caso de uso verificaría que la orden pertenezca al usuario autenticado.