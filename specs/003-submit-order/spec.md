# Spec 003 — Enviar una orden

## Objetivo

Exponer `POST /v1/orders`, que envía una orden de compra o venta de un activo, de tipo MARKET o LIMIT, y la graba en la tabla `orders` con el estado y los valores correspondientes.

Cubre el punto "Enviar una orden al mercado" del enunciado y sus consideraciones funcionales: cantidad exacta o monto en pesos, estados, validación de pesos y de acciones, precio de ejecución y actualización de posiciones. Incluye el test funcional que exige el enunciado.

## Fuera de alcance

- Cancelación de órdenes (fase 004).
- Simulación del mercado: las órdenes LIMIT quedan en `NEW` y nunca se ejecutan.
- Transferencias por API: `CASH_IN` y `CASH_OUT` no se aceptan en este endpoint.
- Horario de mercado, días hábiles y reserva de pesos o acciones por órdenes `NEW`.

## Requisitos

### R1. Body

| Campo | Tipo | Regla |
|---|---|---|
| `userId` | entero | Obligatorio, mayor o igual a 1 |
| `instrumentId` | entero | Obligatorio, mayor o igual a 1 |
| `side` | texto | Obligatorio: `BUY` o `SELL` |
| `type` | texto | Obligatorio: `MARKET` o `LIMIT` |
| `size` | entero | Cantidad de acciones, mayor o igual a 1 |
| `amount` | número | Monto en pesos, mayor a 0, hasta 2 decimales |
| `price` | número | Precio límite, mayor a 0, hasta 2 decimales |

- Se envía **exactamente uno** entre `size` y `amount`.
- `price` es obligatorio si `type` es `LIMIT` y no se admite si es `MARKET`.
- Un body que no cumple estas reglas, o que trae campos desconocidos, devuelve 400 y **no graba nada**.

### R2. Verificaciones previas (error HTTP, no se graba la orden)

| Situación | Status | `code` |
|---|---|---|
| El usuario no existe | 404 | `USER_NOT_FOUND` |
| El instrumento no existe | 404 | `INSTRUMENT_NOT_FOUND` |
| El instrumento es de tipo `MONEDA` | 400 | `INSTRUMENT_NOT_TRADABLE` |
| Orden `MARKET` sobre un instrumento sin datos de mercado | 422 | `MARKET_PRICE_UNAVAILABLE` |

### R3. Precio de la orden

- `MARKET`: el último `close` del instrumento.
- `LIMIT`: el `price` enviado.

### R4. Cantidad de la orden

- Con `size`: esa cantidad.
- Con `amount`: `floor(amount / precio)`, la máxima cantidad de acciones enteras que se puede operar con ese monto. Vale para compra y para venta.

### R5. Estado de la orden

Se evalúa en este orden; la primera regla que aplica define el resultado.

| # | Condición | `status` | `rejectionReason` |
|---|---|---|---|
| 1 | La cantidad calculada por monto es 0 | `REJECTED` | `AMOUNT_BELOW_PRICE` |
| 2 | `BUY` y `cantidad × precio` supera los pesos disponibles | `REJECTED` | `INSUFFICIENT_FUNDS` |
| 3 | `SELL` y la cantidad supera las acciones que el usuario tiene | `REJECTED` | `INSUFFICIENT_SHARES` |
| 4 | `MARKET` | `FILLED` | `null` |
| 5 | `LIMIT` | `NEW` | `null` |

- Los pesos disponibles y la tenencia se calculan con las funciones de la fase 002, es decir, solo con órdenes `FILLED`.
- Comprar por exactamente los pesos disponibles, o vender exactamente lo que se tiene, es válido.
- Un usuario con tenencia negativa o nula de un activo no puede venderlo.

### R6. Persistencia

- Toda orden que pasa R1 y R2 se graba en `orders`, incluidas las `REJECTED`.
- Se graban: `instrumentid`, `userid`, `size`, `price`, `type`, `side`, `status` y `datetime` (hora del servidor en UTC).
- Una orden `REJECTED` por regla 1 se graba con `size` 0.
- Una orden `FILLED` modifica de inmediato los pesos y las posiciones del usuario, porque el portfolio se calcula a partir de `orders`.

### R7. Consistencia ante pedidos simultáneos

La validación de pesos o acciones y el grabado de la orden ocurren como una sola operación por usuario. Dos órdenes simultáneas del mismo usuario nunca pueden aprobarse ambas contra el mismo saldo.

### R8. Respuesta

`201 Created`, también cuando la orden queda `REJECTED`:

```json
{
  "id": 12,
  "userId": 1,
  "instrumentId": 47,
  "side": "BUY",
  "type": "MARKET",
  "size": 10,
  "price": "925.85",
  "status": "FILLED",
  "rejectionReason": null,
  "datetime": "2026-11-12T16:40:00.000Z"
}
```

- `price`: `string` con 2 decimales. `size`: entero. `datetime`: ISO 8601 en UTC.
- `rejectionReason` no se persiste; solo viaja en la respuesta.

## Criterios de aceptación

Contra la base de test. Usuario 1: 753000 pesos, 40 PAMP, 500 METR, −10 BMA. PAMP (id 47) cotiza 925.85. Cada test deja la tabla `orders` con sus 11 filas originales.

### Órdenes aceptadas

| # | Pedido | Resultado esperado |
|---|---|---|
| CA1 | Usuario 1, `BUY` `MARKET` 10 PAMP | 201; `FILLED`; `price` `"925.85"`; `size` 10. Portfolio después: pesos `"743741.50"`, PAMP 50 |
| CA2 | Usuario 1, `SELL` `MARKET` 10 PAMP | 201; `FILLED`. Portfolio después: pesos `"762258.50"`, PAMP 30 |
| CA3 | Usuario 1, `BUY` `LIMIT` 5 PAMP a 900 | 201; `NEW`; `price` `"900.00"`. Portfolio sin cambios |
| CA4 | Usuario 1, `SELL` `LIMIT` 5 PAMP a 950.50 | 201; `NEW`; `price` `"950.50"`. Portfolio sin cambios |
| CA5 | Usuario 1, `BUY` `MARKET` por `amount` 50000 en PAMP | 201; `FILLED`; `size` 54 |
| CA6 | Usuario 1, `BUY` `LIMIT` por `amount` 50000 en PAMP a 900 | 201; `NEW`; `size` 55 |
| CA7 | Usuario 1, `BUY` `MARKET` 813 PAMP (752716.05 pesos) | 201; `FILLED` |
| CA8 | Usuario 1, `SELL` `MARKET` 40 PAMP | 201; `FILLED`. PAMP deja de aparecer en el portfolio |
| CA9 | Usuario 1, `BUY` `LIMIT` de 1 acción a 100 sobre un activo sin datos de mercado | 201; `NEW` |

### Órdenes rechazadas (201 con `REJECTED`, grabadas)

| # | Pedido | `rejectionReason` |
|---|---|---|
| CA10 | Usuario 1, `BUY` `MARKET` 814 PAMP (753641.90 pesos) | `INSUFFICIENT_FUNDS` |
| CA11 | Usuario 1, `BUY` `LIMIT` 1000 PAMP a 900 | `INSUFFICIENT_FUNDS`; `price` `"900.00"` |
| CA12 | Usuario 1, `BUY` `MARKET` por `amount` 1000000 en PAMP | `INSUFFICIENT_FUNDS`; `size` 1080 |
| CA13 | Usuario 2 (sin pesos), `BUY` `MARKET` 1 PAMP | `INSUFFICIENT_FUNDS` |
| CA14 | Usuario 1, `SELL` `MARKET` 41 PAMP | `INSUFFICIENT_SHARES` |
| CA15 | Usuario 1, `SELL` `MARKET` 1 BMA (tenencia −10) | `INSUFFICIENT_SHARES` |
| CA16 | Usuario 1, `SELL` `MARKET` 1 LOMA (sin tenencia) | `INSUFFICIENT_SHARES` |
| CA17 | Usuario 1, `BUY` `MARKET` por `amount` 500 en PAMP | `AMOUNT_BELOW_PRICE`; `size` 0 |

En todos los casos de CA10 a CA17 el portfolio del usuario queda sin cambios.

### Errores (no se graba nada)

| # | Pedido | Resultado esperado |
|---|---|---|
| CA18 | Falta `userId`, `instrumentId`, `side` o `type` | 400 |
| CA19 | `size` y `amount` juntos; ninguno de los dos | 400 |
| CA20 | `LIMIT` sin `price`; `MARKET` con `price` | 400 |
| CA21 | `size` 0, negativo o 1.5; `amount` 0, negativo o con 3 decimales; `price` 0 o negativo | 400 |
| CA22 | `side` `CASH_IN`; `type` `STOP`; campo desconocido | 400 |
| CA23 | `userId` 999 | 404 `USER_NOT_FOUND` |
| CA24 | `instrumentId` 9999 | 404 `INSTRUMENT_NOT_FOUND` |
| CA25 | `instrumentId` 66 (ARS) | 400 `INSTRUMENT_NOT_TRADABLE` |
| CA26 | `MARKET` sobre un activo sin datos de mercado | 422 `MARKET_PRICE_UNAVAILABLE` |

### Persistencia y concurrencia

| # | Caso | Resultado esperado |
|---|---|---|
| CA27 | Después de CA1 | La fila en `orders` tiene los mismos valores que la respuesta, y `datetime` en UTC |
| CA28 | Después de CA10 | La orden `REJECTED` existe en `orders` |
| CA29 | Usuario 2 con un `CASH_IN` de 10000 insertado por el test, y 5 pedidos simultáneos `BUY` `MARKET` 10 PAMP (9258.50 cada uno) | Exactamente 1 `FILLED` y 4 `REJECTED` por `INSUFFICIENT_FUNDS`; pesos finales `"741.50"` |
| CA30 | `npm run lint`, las tres suites y el build | Pasan; coverage 100 % en `src/domain` y al menos 90 % global |