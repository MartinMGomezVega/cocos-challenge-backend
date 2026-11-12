# Contexto de dominio

Esquema real, datos provistos y supuestos acordados. Todo lo que está acá fue verificado contra la base provista por Cocos el 12/11/2026.

## 1. Esquema real

Difiere del enunciado en mayúsculas y en el nombre de una columna.

| Tabla | Columnas (tipo) |
|---|---|
| `users` | `id` (integer, secuencia), `email` (varchar), `accountnumber` (varchar) |
| `instruments` | `id` (integer, secuencia), `ticker` (varchar), `name` (varchar), `type` (varchar) |
| `orders` | `id` (integer, secuencia), `instrumentid` (integer), `userid` (integer), `size` (integer), `price` (numeric), `type` (varchar), `side` (varchar), `status` (varchar), `datetime` (timestamp sin zona horaria) |
| `marketdata` | `id` (integer, secuencia), `instrumentid` (integer), `high`, `low`, `open`, `close`, `previousclose` (numeric), `date` (date) |

Todas las columnas salvo `id` admiten `NULL`.

## 2. Datos provistos

- **Usuarios:** 4 (ids 1 a 4). Solo el usuario 1 tiene órdenes.
- **Instrumentos:** 66. Son 65 de tipo `ACCIONES` y 1 de tipo `MONEDA` (id 66, ticker `ARS`, nombre `PESOS`).
- **Marketdata:** 126 filas, 63 por fecha (2023-07-13 y 2023-07-14). Hay 2 acciones sin datos de mercado, y filas con `high`, `low` y `open` en `NULL`.

### Órdenes (todas del usuario 1)

| id | instrumentid | size | price | type | side | status |
|---|---|---|---|---|---|---|
| 1 | 66 (ARS) | 1000000 | 1.00 | MARKET | CASH_IN | FILLED |
| 2 | 47 (PAMP) | 50 | 930.00 | MARKET | BUY | FILLED |
| 3 | 47 (PAMP) | 50 | 920.00 | LIMIT | BUY | CANCELLED |
| 4 | 47 (PAMP) | 10 | 940.00 | MARKET | SELL | FILLED |
| 5 | 45 (LOMA) | 50 | 710.00 | LIMIT | BUY | NEW |
| 6 | 47 (PAMP) | 100 | 950.00 | MARKET | SELL | REJECTED |
| 7 | 31 (BMA) | 60 | 1500.00 | LIMIT | BUY | NEW |
| 8 | 66 (ARS) | 100000 | 1.00 | MARKET | CASH_OUT | FILLED |
| 9 | 31 (BMA) | 20 | 1540.00 | LIMIT | BUY | FILLED |
| 10 | 54 (METR) | 500 | 250.00 | MARKET | BUY | FILLED |
| 11 | 31 (BMA) | 30 | 1530.00 | MARKET | SELL | FILLED |

Las transferencias (`CASH_IN`, `CASH_OUT`) van sobre el instrumento 66 con `price = 1` y `size` igual al monto en pesos.

### Último precio (2023-07-14) de los activos del usuario 1

| Activo | close | previousclose |
|---|---|---|
| BMA (31) | 1502.80 | 1520.25 |
| LOMA (45) | 734.65 | 734.35 |
| PAMP (47) | 925.85 | 921.80 |
| METR (54) | 229.50 | 232.00 |

## 3. Fórmulas

- **Pesos disponibles** = Σ `size × price` de `CASH_IN` y `SELL` − Σ `size × price` de `CASH_OUT` y `BUY`, solo órdenes `FILLED`.
- **Cantidad de una posición** = Σ `size` de `BUY` − Σ `size` de `SELL`, solo órdenes `FILLED`.
- **Valor de la posición** = cantidad × último `close`.
- **Rendimiento total (%)** = (`close` − precio promedio de compra) / precio promedio de compra × 100. El precio promedio es el ponderado por `size` de las órdenes `BUY` en `FILLED`.
- **Retorno diario (%)** = (`close` − `previousclose`) / `previousclose` × 100.
- **Valor total de la cuenta** = pesos disponibles + Σ valor de todas las posiciones.
- **Último precio** = fila de `marketdata` con la `date` más reciente para ese instrumento.

## 4. Resultado esperado: portfolio del usuario 1

Sirve como primer test de aceptación.

- **Pesos disponibles:** 753000.00
- **Valor total de la cuenta:** 889756.00

| Activo | Cantidad | Valor | Rendimiento total | Retorno diario |
|---|---|---|---|---|
| PAMP | 40 | 37034.00 | -0.45 | 0.44 |
| METR | 500 | 114750.00 | -8.20 | -1.08 |
| BMA | -10 | -15028.00 | null | -1.15 |

Usuarios 2, 3 y 4: pesos 0.00, valor total 0.00, sin posiciones.

## 5. Supuestos acordados

El enunciado no los define; se documentan también en el README.

| # | Supuesto |
|---|---|
| S1 | Solo las órdenes `FILLED` mueven pesos y tenencia. Las `NEW` no reservan pesos ni acciones. |
| S2 | La posición negativa de BMA (venta `FILLED` de 30 con 20 comprados) es una anomalía de los datos provistos. Se muestra tal cual y no se corrige ningún dato. |
| S3 | En posiciones con cantidad negativa, el rendimiento total es `null`. |
| S4 | Las posiciones con cantidad 0 no se listan. ARS (tipo `MONEDA`) nunca se lista como posición. |
| S5 | El retorno diario se informa por activo, en la búsqueda y en cada posición del portfolio. |
| S6 | Precio para validar y grabar una orden: el `close` si es MARKET, el precio enviado si es LIMIT. |
| S7 | Orden por monto: `size = floor(amount / precio)`. Si da 0, la orden se graba como `REJECTED` con `rejectionReason` `AMOUNT_BELOW_PRICE`. |
| S8 | Compra por más pesos que los disponibles, o venta por más acciones que las que se tienen: la orden se graba como `REJECTED` y la respuesta es `201 Created` con ese estado. El recurso se creó; el rechazo es un estado de la orden, no un fallo del request. |
| S8b | La respuesta de una orden `REJECTED` incluye el campo `rejectionReason`: `INSUFFICIENT_FUNDS` (compra) o `INSUFFICIENT_SHARES` (venta). En los demás estados vale `null`. No se persiste: la tabla `orders` no tiene columna para eso. |
| S9 | Request inválido (campos faltantes o mal formados, usuario o instrumento inexistente): error HTTP y la orden no se graba. |
| S10 | `POST /v1/orders` solo acepta `side` `BUY` o `SELL`, y no opera instrumentos de tipo `MONEDA`. |
| S11 | Activo sin datos de mercado: en la búsqueda aparece con precio y retorno diario `null`. Una orden MARKET sobre él devuelve error HTTP y no se graba. |
| S12 | Cancelar una orden que no está en `NEW` devuelve error HTTP y no modifica nada. |
| S13 | El `datetime` de una orden nueva es la hora del servidor en UTC al momento de crearla. |
| S14 | Sin autenticación: el usuario se identifica con `userId` en la ruta o en el body. |
| S15 | No se valida horario de mercado ni días hábiles: una orden se acepta a cualquier hora. |

## 6. Fuera de alcance (sección "Qué agregaría en producción" del README)

Se conocen y se dejan afuera a propósito. No se implementan.

| Tema | Por qué queda afuera |
|---|---|
| Validación de horario de rueda y días hábiles, con calendario de feriados | El enunciado pide no simular el mercado y que toda orden MARKET quede `FILLED` de inmediato. Además los precios provistos son de julio de 2023, y validar el reloj actual haría fallar el challenge si se prueba fuera de horario. |
| Reserva de pesos y acciones por órdenes LIMIT en `NEW` | El enunciado indica calcular pesos y tenencia solo con órdenes `FILLED`. |
| Autenticación y autorización | El enunciado indica que no es necesaria. |