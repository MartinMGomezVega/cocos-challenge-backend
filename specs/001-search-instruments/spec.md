# Spec 001 — Buscar activos

## Objetivo

Exponer `GET /v1/instruments`, que devuelve los activos del mercado cuyo ticker y/o nombre coinciden con la búsqueda, con su último precio en pesos y su retorno diario.

Cubre el punto "Buscar activos" del enunciado y las consideraciones sobre precios en pesos, `close` como último precio y retorno diario con `close` y `previousClose`.

## Alcance

1. Endpoint `GET /v1/instruments` con búsqueda y paginado.
2. Cálculo del retorno diario en el dominio.
3. Formato común de decimales para montos y porcentajes.
4. Comprobación de que la base de test responde antes de correr la suite funcional.
5. Ejemplos en `postman/cocos-challenge-backend.postman_collection.json`.

## Fuera de alcance

- Portfolio, órdenes y cancelación (fases 002 a 004).
- Cambios de esquema o índices.

## Requisitos

### R1. Parámetros

| Parámetro | Tipo | Regla | Por defecto |
|---|---|---|---|
| `query` | texto | Opcional. Se le quitan espacios al inicio y al final. Máximo 50 caracteres. | sin filtro |
| `page` | entero | Entre 1 y 1000000. | 1 |
| `limit` | entero | Entre 1 y 100. | 20 |

- Un parámetro inválido o un parámetro desconocido devuelve 400.
- `query` vacío o solo con espacios equivale a no enviarlo.

### R2. Búsqueda

- Coincidencia parcial y sin distinguir mayúsculas sobre `ticker` **o** `name`.
- Los caracteres `%` y `_` del texto se tratan como literales, no como comodines.
- Sin `query`, se devuelven todos los activos.
- Los instrumentos de tipo `MONEDA` (ARS) nunca se devuelven: son la moneda, no un activo operable.
- Orden: `ticker` ascendente y, a igualdad, `id` ascendente.

### R3. Precio y retorno diario

- El último precio es el `close` de la fila de `marketdata` con la `date` más reciente de ese instrumento.
- Retorno diario (%) = (`close` − `previousclose`) / `previousclose` × 100.
- Si el activo no tiene datos de mercado, `lastPrice` y `dailyReturnPct` son `null`.
- Si `previousclose` es `null` o 0, `dailyReturnPct` es `null`.

### R4. Respuesta

`200 OK`:

```json
{
  "data": [
    {
      "id": 47,
      "ticker": "PAMP",
      "name": "Pampa Holding S.A.",
      "type": "ACCIONES",
      "lastPrice": "925.85",
      "dailyReturnPct": "0.44"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

- `lastPrice` y `dailyReturnPct` son `string` con 2 decimales y redondeo half-up, o `null`. Nunca `"-0.00"`.
- `total` es la cantidad de activos que coinciden; `totalPages` = techo de `total / limit` (0 si `total` es 0).
- Una búsqueda sin coincidencias, o una página más allá de la última, devuelve 200 con `data: []`.

### R5. Base de test disponible

- Antes de correr la suite funcional se comprueba que la base responde.
- Si no responde, la suite corta de inmediato con un mensaje que indica ejecutar `docker compose up -d db-test`, sin reintentos ni errores internos del driver.

## Criterios de aceptación

Todos contra la base de test (datos de `specs/domain-context.md`).

| # | Pedido | Resultado esperado |
|---|---|---|
| CA1 | `?query=pamp` | 1 resultado: id 47, `lastPrice` `"925.85"`, `dailyReturnPct` `"0.44"`; `total` 1 |
| CA2 | `?query=PaMp` | Igual que CA1 |
| CA3 | `?query=macro` | Incluye BMA (id 31) con `lastPrice` `"1502.80"` y `dailyReturnPct` `"-1.15"` |
| CA4 | `?query=metr` | Incluye METR (id 54) con `lastPrice` `"229.50"` y `dailyReturnPct` `"-1.08"` |
| CA5 | sin parámetros | 20 resultados ordenados por ticker; `total` 65; `totalPages` 4 |
| CA6 | `?page=4` | 5 resultados |
| CA7 | `?page=5` | `data: []`; `total` 65 |
| CA8 | `?limit=100` | 65 resultados; ninguno de tipo `MONEDA` ni con id 66 |
| CA9 | `?query=zzzzzz` | `data: []`; `total` 0; `totalPages` 0 |
| CA10 | `?query=%` | `data: []` (el `%` no actúa como comodín) |
| CA11 | `?limit=100` | Los 2 activos sin datos de mercado traen `lastPrice` y `dailyReturnPct` en `null` |
| CA12 | `?page=0`, `?limit=101`, `?limit=abc`, `?foo=1`, `query` de 51 caracteres | 400 en cada caso |
| CA13 | Base de test apagada + `npm run test:functional` | Corta con el mensaje de R5 |
| CA14 | `npm run lint`, `npm test`, `npm run test:functional`, `npm run test:cov` | Pasan; coverage 100 % en `src/domain` y al menos 90 % global |