# Spec 002 — Portfolio

## Objetivo

Exponer `GET /v1/users/:userId/portfolio`, que devuelve el valor total de la cuenta del usuario, sus pesos disponibles para operar y el listado de activos que posee, con cantidad de acciones, valor monetario de la posición y rendimiento total (%).

Cubre el punto "Portfolio" del enunciado y las consideraciones sobre el cálculo de tenencia y pesos con la tabla `orders`, el uso exclusivo de órdenes `FILLED`, ARS como instrumento de tipo `MONEDA` y las transferencias `CASH_IN` / `CASH_OUT`.

Los cálculos de pesos disponibles y de tenencia se reutilizan en la fase 003 para validar órdenes.

## Fuera de alcance

- Envío y cancelación de órdenes (fases 003 y 004).
- Reserva de pesos o acciones por órdenes `NEW`.
- Cambios de esquema, tablas de posiciones o saldos.

## Requisitos

### R1. Parámetro

- `userId` es un entero mayor o igual a 1. Cualquier otro valor devuelve 400.
- Si el usuario no existe, devuelve 404 con `code` `USER_NOT_FOUND`.

### R2. Movimientos considerados

- Solo cuentan las órdenes del usuario en estado `FILLED`. Las órdenes `NEW`, `REJECTED` y `CANCELLED` no afectan pesos ni tenencia.
- Las filas con `size` o `price` en `NULL` se ignoran.

### R3. Pesos disponibles

Pesos disponibles = Σ `size × price` de `CASH_IN` y `SELL` − Σ `size × price` de `CASH_OUT` y `BUY`.

### R4. Posiciones

- Se agrupan por instrumento las órdenes `BUY` y `SELL`. Las transferencias y los instrumentos de tipo `MONEDA` no generan posición.
- Cantidad = Σ `size` de `BUY` − Σ `size` de `SELL`.
- Las posiciones con cantidad 0 no se listan.
- Las posiciones con cantidad negativa se listan tal cual (anomalía de los datos provistos, ver `specs/domain-context.md` S2).
- Precio promedio de compra = Σ `size × price` de `BUY` / Σ `size` de `BUY`.
- Orden del listado: `ticker` ascendente.

### R5. Valuación

- Valor de la posición = cantidad × último `close` del instrumento.
- Rendimiento total (%) = (`close` − precio promedio de compra) / precio promedio de compra × 100.
- El rendimiento total es `null` si la cantidad es negativa, si no hay compras o si el precio promedio es 0.
- Retorno diario (%): el del instrumento, igual que en la fase 001.
- Si el instrumento no tiene datos de mercado, `marketValue`, `totalReturnPct` y `dailyReturnPct` son `null` y la posición no suma al valor total.

### R6. Valor total de la cuenta

Valor total = pesos disponibles + Σ valor de las posiciones con precio (incluidas las negativas).

### R7. Respuesta

`200 OK`:

```json
{
  "userId": 1,
  "totalAccountValue": "889756.00",
  "availableCash": "753000.00",
  "positions": [
    {
      "instrumentId": 31,
      "ticker": "BMA",
      "name": "Banco Macro S.A.",
      "quantity": -10,
      "marketValue": "-15028.00",
      "totalReturnPct": null,
      "dailyReturnPct": "-1.15"
    }
  ]
}
```

- Montos y porcentajes: `string` con 2 decimales y redondeo half-up, o `null`. Nunca `"-0.00"`.
- `quantity`: `number` entero.

## Criterios de aceptación

Contra la base de test (datos de `specs/domain-context.md`).

| # | Caso | Resultado esperado |
|---|---|---|
| CA1 | Usuario 1 | `availableCash` `"753000.00"`; `totalAccountValue` `"889756.00"`; tres posiciones en este orden: BMA, METR, PAMP |
| CA2 | Usuario 1, BMA | `quantity` −10; `marketValue` `"-15028.00"`; `totalReturnPct` `null`; `dailyReturnPct` `"-1.15"` |
| CA3 | Usuario 1, METR | `quantity` 500; `marketValue` `"114750.00"`; `totalReturnPct` `"-8.20"`; `dailyReturnPct` `"-1.08"` |
| CA4 | Usuario 1, PAMP | `quantity` 40; `marketValue` `"37034.00"`; `totalReturnPct` `"-0.45"`; `dailyReturnPct` `"0.44"` |
| CA5 | Usuario 1 | LOMA (id 45) no aparece: su única orden está en `NEW` |
| CA6 | Usuarios 2, 3 y 4 | `availableCash` `"0.00"`; `totalAccountValue` `"0.00"`; `positions` vacío |
| CA7 | Usuario 999 | 404 con `code` `USER_NOT_FOUND` |
| CA8 | `userId` `abc`, `0`, `-1`, `1.5` | 400 en cada caso |
| CA9 | Usuario 2 con órdenes insertadas por el test: `CASH_IN` 100000 y `BUY` 10 PAMP a 900, ambas `FILLED` | `availableCash` `"91000.00"`; PAMP con `quantity` 10, `marketValue` `"9258.50"`, `totalReturnPct` `"2.87"`; `totalAccountValue` `"100258.50"` |
| CA10 | Igual que CA9 más un `SELL` 10 PAMP a 950 `FILLED` | `availableCash` `"100500.00"`; sin posiciones; `totalAccountValue` `"100500.00"` |
| CA11 | Dominio: compras de 10 a 100 y 30 a 200 | Precio promedio 175 |
| CA12 | Dominio: posición sobre un instrumento sin precio | Valores `null` y no suma al total |
| CA13 | `npm run lint`, las tres suites y el build | Pasan; coverage 100 % en `src/domain` y al menos 90 % global |

Los tests que insertan órdenes (CA9, CA10) borran lo insertado al terminar.