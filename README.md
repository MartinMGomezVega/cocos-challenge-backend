# cocos-challenge-backend

API REST que resuelve el [backend challenge de Cocos Capital](specs/backend-challenge.md): portfolio de un usuario, búsqueda de activos y envío de órdenes al mercado. Suma un cuarto endpoint para cancelar órdenes.

- **Stack:** Node.js 26, NestJS 11, TypeScript estricto, PostgreSQL, TypeORM.
- **Tests:** 219, con 100 % de coverage.
- **Documentación de diseño:** carpeta [`specs/`](specs/), con una especificación por funcionalidad.

## Cómo ejecutarlo

Requisitos: Node.js 26 (hay un `.nvmrc`) y npm. Docker solo hace falta para correr los tests.

```bash
nvm use
npm install
cp .env.example .env
```

La API necesita una base PostgreSQL con el esquema y los datos del challenge. Se configura con la variable `DATABASE_URL` del archivo `.env`, y hay dos formas de hacerlo.

### Opción A: la base provista por Cocos

Completar `DATABASE_URL` en `.env` con el connection string entregado junto con el challenge:

```
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST/BASE?sslmode=require
PORT=3000
```

La conexión usa SSL de forma automática cuando el host no es local. Tener en cuenta que `POST /v1/orders` y `PATCH /v1/orders/:orderId/cancel` escriben en esa base.

### Opción B: una base local con Docker

El repo incluye los datos del challenge en `database/database.sql` y un `docker-compose.yml` que levanta un PostgreSQL ya cargado con ellos:

```bash
docker compose up -d db-test
```

Completar `.env` con:

```
DATABASE_URL=postgresql://cocos:cocos@localhost:5433/cocos_test
PORT=3000
```

Es la misma base que usan los tests, y la opción recomendada para probar órdenes sin modificar datos compartidos. Para volver a los datos originales:

```bash
docker compose down -v
docker compose up -d db-test
```

### Levantar la API

```bash
npm run start:dev
```

La API queda en `http://localhost:3000`. Para correr la versión compilada: `npm run build` y `npm run start:prod`.

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /v1/users/:userId/portfolio` | Valor total de la cuenta, pesos disponibles y posiciones |
| `GET /v1/instruments?query=&page=&limit=` | Busca activos por ticker y/o nombre |
| `POST /v1/orders` | Envía una orden de compra o venta, MARKET o LIMIT |
| `PATCH /v1/orders/:orderId/cancel` | Cancela una orden en estado `NEW` |

Para probarlos y consultarlos hay cuatro recursos en el repo:

| Recurso | Ubicación | Cómo usarlo |
|---|---|---|
| Colección de Postman | [`postman/cocos-challenge-backend.postman_collection.json`](postman/cocos-challenge-backend.postman_collection.json) | Importar en Postman. La variable `baseUrl` apunta a `http://localhost:3000` |
| Especificación OpenAPI 3 | [`openapi/openapi.yaml`](openapi/openapi.yaml) | Abrir en [editor.swagger.io](https://editor.swagger.io) o con cualquier visor de OpenAPI |
| Swagger UI (GitHub Pages) | [`docs/`](docs/) | Abrir [`docs/index.html`](docs/index.html) o publicar desde GitHub Pages |
| Ejemplos REST Client | [`http/`](http/) | Ejecutar desde el editor con la extensión REST Client |

### Portfolio

```bash
curl http://localhost:3000/v1/users/1/portfolio
```

```json
{
  "userId": 1,
  "totalAccountValue": "889756.00",
  "availableCash": "753000.00",
  "positions": [
    { "instrumentId": 31, "ticker": "BMA", "name": "Banco Macro S.A.", "quantity": -10,
      "marketValue": "-15028.00", "totalReturnPct": null, "dailyReturnPct": "-1.15" },
    { "instrumentId": 54, "ticker": "METR", "name": "MetroGAS S.A.", "quantity": 500,
      "marketValue": "114750.00", "totalReturnPct": "-8.20", "dailyReturnPct": "-1.08" },
    { "instrumentId": 47, "ticker": "PAMP", "name": "Pampa Holding S.A.", "quantity": 40,
      "marketValue": "37034.00", "totalReturnPct": "-0.45", "dailyReturnPct": "0.44" }
  ]
}
```

### Buscar activos

```bash
curl "http://localhost:3000/v1/instruments?query=pamp"
curl "http://localhost:3000/v1/instruments?query=banco&page=1&limit=10"
```

```json
{
  "data": [
    { "id": 47, "ticker": "PAMP", "name": "Pampa Holding S.A.", "type": "ACCIONES",
      "lastPrice": "925.85", "dailyReturnPct": "0.44" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`query` es opcional; sin él se listan todos los activos. `page` arranca en 1 y `limit` va de 1 a 100 (20 por defecto).

### Enviar una orden

Los `id` de las respuestas son ilustrativos y dependen del estado de la base.

```bash
# MARKET por cantidad de acciones
curl -X POST http://localhost:3000/v1/orders -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":47,"side":"BUY","type":"MARKET","size":10}'

# MARKET por monto en pesos (compra la máxima cantidad de acciones enteras)
curl -X POST http://localhost:3000/v1/orders -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":47,"side":"BUY","type":"MARKET","amount":50000}'

# LIMIT
curl -X POST http://localhost:3000/v1/orders -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":47,"side":"SELL","type":"LIMIT","size":5,"price":950.50}'

# Orden que queda REJECTED: vende más acciones de las que tiene
curl -X POST http://localhost:3000/v1/orders -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":47,"side":"SELL","type":"MARKET","size":200}'
```

```json
{
  "id": 12, "userId": 1, "instrumentId": 47, "side": "BUY", "type": "MARKET",
  "size": 10, "price": "925.85", "status": "FILLED", "rejectionReason": null,
  "datetime": "2026-11-12T16:40:00.000Z"
}
```

| Campo | Regla |
|---|---|
| `userId`, `instrumentId` | Enteros, obligatorios |
| `side` | `BUY` o `SELL` |
| `type` | `MARKET` o `LIMIT` |
| `size` o `amount` | Exactamente uno: cantidad de acciones, o monto en pesos |
| `price` | Obligatorio en `LIMIT`; no se admite en `MARKET` |

### Cancelar una orden

```bash
curl -X PATCH http://localhost:3000/v1/orders/<orderId>/cancel
```

Donde `<orderId>` es el `id` devuelto al crear una orden `LIMIT`. Devuelve la orden con `status` `CANCELLED`. Solo se pueden cancelar órdenes en `NEW`.

### Errores

Los errores de negocio responden `{ "code", "message" }`:

| Status | `code` | Cuándo |
|---|---|---|
| 400 | `INSTRUMENT_NOT_TRADABLE` | Orden sobre ARS, que es la moneda |
| 404 | `USER_NOT_FOUND`, `INSTRUMENT_NOT_FOUND`, `ORDER_NOT_FOUND` | El recurso no existe |
| 409 | `ORDER_NOT_CANCELLABLE` | Cancelar una orden que no está en `NEW` |
| 422 | `MARKET_PRICE_UNAVAILABLE` | Orden MARKET sobre un activo sin precio |

Un pedido mal formado devuelve 400 con el detalle de los campos inválidos.

## Tests

```bash
npm test                    # unitarios: dominio y casos de uso. No necesita Docker.

docker compose up -d db-test
npm run test:functional     # integración y funcionales por HTTP, contra Postgres
npm run test:cov            # todo, con coverage
```

- La base de test es un Postgres local en el puerto 5433, cargado con `database/database.sql`.
- Los tests nunca corren contra la base provista: el arranque aborta si `DATABASE_URL` apunta a ella.
- El test funcional de envío de órdenes que pide el enunciado está en [`test/functional/orders.spec.ts`](test/functional/orders.spec.ts).

## Arquitectura

Arquitectura horizontal por capas, con la regla de dependencias de Clean Architecture: todo apunta hacia el dominio.

```
src/
├── domain/           # reglas de negocio puras, sin framework ni base de datos
├── application/      # casos de uso y puertos (interfaces de repositorios)
├── infrastructure/   # TypeORM: entidades y repositorios que implementan los puertos
├── presentation/     # controllers, DTOs y traducción de errores a HTTP
└── composition/      # módulos de NestJS que conectan las piezas
```

Las fórmulas del enunciado (pesos disponibles, tenencia, rendimiento, validación de una orden) son funciones puras en `domain/`, testeadas sin base de datos. El envío de órdenes reutiliza las mismas funciones que el portfolio, así que ambos calculan igual por construcción.

## Decisiones de diseño y supuestos

### Sobre los datos provistos

- **El esquema real difiere del enunciado.** Las columnas están en minúsculas (`instrumentid`, `previousclose`) y la fecha de `marketdata` se llama `date`. Las entidades mapean a los nombres reales.
- **No se modificó el esquema.** No hay tablas, columnas ni índices nuevos; la API funciona contra la base tal como fue entregada.
- **Posición negativa en BMA.** El usuario 1 tiene una venta `FILLED` de 30 acciones con solo 20 compradas. Es una anomalía de los datos y se muestra tal cual: cantidad −10, valor negativo y rendimiento total `null`. La API no permitiría crear una orden así.
- **Hay dos acciones sin datos de mercado.** En la búsqueda aparecen con precio `null`; se pueden operar con órdenes LIMIT pero no con MARKET.

### Cálculos

- **Solo las órdenes `FILLED` mueven pesos y tenencia**, como indica el enunciado. Las órdenes `NEW` no reservan pesos ni acciones.
- **Pesos disponibles** = `CASH_IN` + ventas − `CASH_OUT` − compras, con `size × price` de cada orden.
- **Rendimiento total (%)** = (último precio − precio promedio de compra) / precio promedio de compra. El enunciado no define la fórmula; se usa el promedio ponderado por cantidad.
- **Valor total de la cuenta** = pesos disponibles + valor de mercado de todas las posiciones.
- **Último precio** = el `close` de la fecha más reciente de cada instrumento.
- **Retorno diario** con `close` y `previousClose`, informado por activo en la búsqueda y en el portfolio.
- **Dinero sin punto flotante.** Todos los montos, precios y porcentajes se calculan con `decimal.js` y viajan como texto con dos decimales.

### Órdenes

- **Una orden rechazada devuelve `201`, no un error.** El enunciado pide grabarla en estado `REJECTED`, así que el recurso se crea; el rechazo es un estado de la orden. La respuesta incluye `rejectionReason` (`INSUFFICIENT_FUNDS`, `INSUFFICIENT_SHARES` o `AMOUNT_BELOW_PRICE`), que no se persiste porque la tabla no tiene columna para eso.
- **Un pedido inválido devuelve un error HTTP y no graba nada.** La diferencia con el punto anterior: acá el pedido está mal formado o apunta a algo que no existe; allá el pedido es válido y el mercado lo rechaza.
- **Orden por monto:** se calcula la máxima cantidad de acciones enteras, `floor(monto / precio)`. Si no alcanza para una acción, la orden queda `REJECTED`. Se admite en compras y en ventas.
- **Precio de la orden:** el `close` en MARKET y el precio enviado en LIMIT. Con ese precio se valida y se graba.
- **ARS no se opera.** Es el instrumento de tipo `MONEDA` que modela los pesos; no aparece en la búsqueda ni como posición.
- **No se valida horario de mercado ni días hábiles.** El enunciado pide no simular el mercado y los precios provistos son de julio de 2023.

### Concurrencia

Los pesos y las acciones disponibles se calculan a partir de las órdenes ejecutadas. Para que dos órdenes simultáneas del mismo usuario no se aprueben contra el mismo saldo, la validación y el grabado ocurren dentro de una transacción que bloquea la fila del usuario (`SELECT … FOR UPDATE`). La segunda orden espera a que termine la primera y valida contra el saldo actualizado.

El bloqueo es por usuario, vive en la base de datos (funciona con varias instancias del servicio) y no requiere cambios de esquema. Un test dispara cinco compras simultáneas para un saldo que alcanza para una y verifica que se ejecute exactamente una.

La cancelación usa una sola sentencia `UPDATE … WHERE status = 'NEW'`, de modo que dos cancelaciones simultáneas no pueden aplicarse ambas.

### Cancelación

El enunciado define el estado `CANCELLED` y la regla "solo se pueden cancelar las órdenes con estado `NEW`", pero no pide el endpoint. Se agregó para que la regla sea verificable desde la API.

## Qué agregaría en producción

Quedaron fuera a propósito, por estar fuera del alcance del enunciado:

- **Idempotencia.** Si un cliente reintenta un pedido por un corte de red, hoy se crean dos órdenes. La solución es una clave única por pedido (`Idempotency-Key`) guardada con un índice único. Exige modificar el esquema y el contrato del endpoint.
- **Saldos y posiciones materializados.** Recalcular desde las órdenes es correcto y simple para este volumen. Con historiales largos se mantendrían saldos y posiciones actualizados en la misma transacción que ejecuta cada orden.
- **Reserva de pesos y acciones por órdenes `NEW`.** Hoy un usuario puede dejar varias órdenes LIMIT que en conjunto superen su saldo.
- **Horario de rueda y días hábiles**, con calendario de feriados.
- **Autenticación y autorización.** Entre otras cosas, para verificar que una orden pertenezca a quien la cancela.
- **Índices** sobre `orders(userid, status)` y `marketdata(instrumentid, date)`.

## Cómo se desarrolló

El proyecto se hizo con desarrollo guiado por especificaciones y TDD. Cada funcionalidad tiene en [`specs/`](specs/) su especificación con criterios de aceptación, su plan técnico y sus tareas; el código se escribió después, test primero y con un commit por tarea.

- [`specs/domain-context.md`](specs/domain-context.md): esquema real, datos provistos, el portfolio del usuario 1 calculado a mano y la lista completa de supuestos.
- [`specs/architecture.md`](specs/architecture.md): reglas de arquitectura, dinero y testing.
- Una carpeta por fase: foundation, búsqueda, portfolio, envío de órdenes y cancelación.