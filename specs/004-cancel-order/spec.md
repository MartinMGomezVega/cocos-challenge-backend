# Spec 004 — Cancelar una orden

## Objetivo

Exponer `PATCH /v1/orders/:orderId/cancel`, que cancela una orden en estado `NEW` y la deja en `CANCELLED`.

Cubre dos consideraciones del enunciado: el estado `CANCELLED` ("cuando la orden es cancelada por el usuario") y la regla "solo se pueden cancelar las órdenes con estado `NEW`". El enunciado no pide este endpoint de forma explícita; se agrega para que la regla sea verificable desde la API.

## Fuera de alcance

- Verificar que quien cancela sea el dueño de la orden: no hay autenticación (lo indica el enunciado).
- Cualquier otro cambio de estado.

## Requisitos

### R1. Parámetro

- `orderId` es un entero entre 1 y 2147483647. Cualquier otro valor devuelve 400.
- El pedido no lleva body.

### R2. Reglas

| Situación | Status | `code` | Efecto |
|---|---|---|---|
| La orden no existe | 404 | `ORDER_NOT_FOUND` | Ninguno |
| La orden no está en `NEW` | 409 | `ORDER_NOT_CANCELLABLE` | Ninguno |
| La orden está en `NEW` | 200 | — | Pasa a `CANCELLED` |

- Solo cambia la columna `status`. El resto de la orden, incluido `datetime`, queda igual.
- Cancelar no modifica los pesos ni las posiciones del usuario, porque las órdenes `NEW` no cuentan en esos cálculos.

### R3. Consistencia ante pedidos simultáneos

Si dos pedidos intentan cancelar la misma orden al mismo tiempo, uno devuelve 200 y el otro 409. La orden nunca se cancela dos veces.

### R4. Respuesta

`200 OK` con el mismo formato que la respuesta de `POST /v1/orders`:

```json
{
  "id": 12,
  "userId": 1,
  "instrumentId": 47,
  "side": "BUY",
  "type": "LIMIT",
  "size": 5,
  "price": "900.00",
  "status": "CANCELLED",
  "rejectionReason": null,
  "datetime": "2026-11-12T16:40:00.000Z"
}
```

## Criterios de aceptación

Contra la base de test. Las órdenes a cancelar las crea cada test con `POST /v1/orders`; las órdenes provistas en `NEW` (5 y 7) no se cancelan.

| # | Caso | Resultado esperado |
|---|---|---|
| CA1 | Crear una `LIMIT` `BUY` de 5 PAMP a 900 (queda `NEW`) y cancelarla | 200; `status` `CANCELLED`; mismo `id`, `size`, `price` y `datetime`; la fila en `orders` queda `CANCELLED` |
| CA2 | Cancelar otra vez la orden de CA1 | 409 `ORDER_NOT_CANCELLABLE` |
| CA3 | Crear una `MARKET` `BUY` de 1 PAMP (queda `FILLED`) y cancelarla | 409; la orden sigue `FILLED` |
| CA4 | Crear una orden que queda `REJECTED` y cancelarla | 409; la orden sigue `REJECTED` |
| CA5 | Cancelar la orden 2 (`FILLED`), la 3 (`CANCELLED`) y la 6 (`REJECTED`) | 409 en cada una; sin cambios |
| CA6 | `orderId` 99999 | 404 `ORDER_NOT_FOUND` |
| CA7 | `orderId` `abc`, `0`, `-1`, `1.5` | 400 en cada caso |
| CA8 | Portfolio del usuario antes y después de CA1 | Idéntico |
| CA9 | Dos cancelaciones simultáneas de una misma orden `NEW` | Exactamente una devuelve 200 y la otra 409 |
| CA10 | Al terminar la suite | `orders` tiene sus 11 filas originales, y las órdenes 5 y 7 siguen en `NEW` |
| CA11 | `npm run lint`, las tres suites y el build | Pasan; coverage 100 % en `src/domain` y al menos 90 % global |