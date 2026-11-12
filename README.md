# cocos-challenge-backend

Mi resolución del [backend challenge de Cocos Capital](specs/backend-challenge.md). Es una API REST con los tres endpoints que pide el enunciado (portfolio, búsqueda de activos y envío de órdenes) y un cuarto que sumé para cancelar órdenes.

Está hecha con Node.js 26, NestJS 11, TypeScript, PostgreSQL y TypeORM. Tiene 219 tests y 100 % de coverage.

## Documentación de la API

La forma más rápida de ver qué hace cada endpoint, sin instalar nada:

**https://martinmgomezvega.github.io/cocos-challenge-backend/**

Es un Swagger con los cuatro endpoints, sus parámetros, respuestas y errores. Además dejé en el repo:

| Recurso | Dónde está | Para qué |
|---|---|---|
| Colección de Postman | [`postman/cocos-challenge-backend.postman_collection.json`](postman/cocos-challenge-backend.postman_collection.json) | Se importa en Postman y ya trae 23 pedidos armados, con casos correctos y de error |
| Especificación OpenAPI 3 | [`openapi/openapi.yaml`](openapi/openapi.yaml) | Es el archivo que alimenta el Swagger de arriba |

### Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /v1/users/:userId/portfolio` | Valor total de la cuenta, pesos disponibles y posiciones |
| `GET /v1/instruments?query=&page=&limit=` | Busca activos por ticker y/o nombre |
| `POST /v1/orders` | Envía una orden de compra o venta, MARKET o LIMIT |
| `PATCH /v1/orders/:orderId/cancel` | Cancela una orden en estado `NEW` |

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

`query` es opcional: si no se manda, lista todos los activos. Está paginado de a 20, con un máximo de 100 por página.

### Enviar una orden

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

# Queda REJECTED: quiere vender más acciones de las que tiene
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

El `id` del ejemplo es ilustrativo; depende de cuántas órdenes haya en la base.

| Campo | Regla |
|---|---|
| `userId`, `instrumentId` | Enteros, obligatorios |
| `side` | `BUY` o `SELL` |
| `type` | `MARKET` o `LIMIT` |
| `size` o `amount` | Uno de los dos, nunca ambos: cantidad de acciones o monto en pesos |
| `price` | Obligatorio en `LIMIT`; en `MARKET` no se admite |

### Cancelar una orden

```bash
curl -X PATCH http://localhost:3000/v1/orders/<orderId>/cancel
```

`<orderId>` es el `id` que devuelve el `POST` al crear una orden `LIMIT`. Solo se pueden cancelar órdenes en `NEW`.

### Errores

Los errores de negocio responden `{ "code", "message" }`:

| Status | `code` | Cuándo |
|---|---|---|
| 400 | `INSTRUMENT_NOT_TRADABLE` | Orden sobre ARS, que es la moneda |
| 404 | `USER_NOT_FOUND`, `INSTRUMENT_NOT_FOUND`, `ORDER_NOT_FOUND` | El recurso no existe |
| 409 | `ORDER_NOT_CANCELLABLE` | Se quiere cancelar una orden que no está en `NEW` |
| 422 | `MARKET_PRICE_UNAVAILABLE` | Orden MARKET sobre un activo sin precio |

Si el pedido está mal formado, devuelve 400 con el detalle de los campos inválidos.

## Cómo levantarlo

Hace falta Node.js 26 (dejé un `.nvmrc`) y npm. Docker solo se necesita para correr los tests o para usar la base local.

```bash
nvm use
npm install
cp .env.example .env
```

La API necesita una base PostgreSQL con el esquema y los datos del challenge. Se configura con `DATABASE_URL` en el `.env`, y hay dos opciones.

### Opción A: la base que me pasaron ustedes

Poner en `.env` el connection string que venía en el mail del challenge:

```
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST/BASE?sslmode=require
PORT=3000
```
La deje comentada para que no se toque la base de datos que es compartida. Si se quiere usar esta opción, hay que descomentarla y comentar la opción B.

CUIDADO que `POST /v1/orders` y `PATCH /v1/orders/:orderId/cancel` modifican la base de datos que es compartida.

### Opción B: una base local con Docker

Dejé en el repo los datos del challenge (`database/database.sql`) y un `docker-compose.yml` que levanta un PostgreSQL ya cargado:

```bash
docker compose up -d db-test
```

Y en `.env`:

```
DATABASE_URL=postgresql://cocos:cocos@localhost:5433/cocos_test
PORT=3000
```

Es la que recomiendo para probar órdenes, porque no modifica los datos compartidos. Para volver a los datos originales:

```bash
docker compose down -v
docker compose up -d db-test
```

### Levantar la API

```bash
npm run start:dev
```

Queda en `http://localhost:3000`. Para correr la versión compilada: `npm run build` y después `npm run start:prod`.

## Tests

```bash
npm test                    # unitarios (dominio y casos de uso).

docker compose up -d db-test
npm run test:functional     # integración y funcionales por HTTP, contra Postgres
npm run test:cov            # todo junto, con coverage
```

El test funcional sobre el envío de órdenes que pide el enunciado está en [`test/functional/orders.spec.ts`](test/functional/orders.spec.ts).

Los tests corren siempre contra la base local. Les puse una guardia que corta la ejecución si `DATABASE_URL` apunta a la base compartida, para no ensuciarla por error.

## Cómo está armado

Usé una arquitectura horizontal por capas, respetando la regla de dependencias de Clean Architecture: todo depende del dominio y el dominio no depende de nada.

```
src/
├── domain/           # reglas de negocio puras, sin framework ni base de datos
├── application/      # casos de uso y puertos (interfaces de repositorios)
├── infrastructure/   # TypeORM: entidades y repositorios
├── presentation/     # controllers, DTOs y traducción de errores a HTTP
└── composition/      # módulos de NestJS que conectan todo
```

Las fórmulas del enunciado (pesos disponibles, tenencia, rendimiento, validación de una orden) son funciones puras dentro de `domain/` y se testean sin base de datos. El envío de órdenes usa las mismas funciones que el portfolio, así que no hay forma de que calculen distinto.

## IMPORTANTE: Decisiones y supuestos

El enunciado pide documentar los supuestos. Estos son los que tomé y por qué.

### Sobre los datos

Antes de escribir código revisé la base y encontré algunas cosas que no coincidían con el enunciado:

- Las columnas están en minúsculas (`instrumentid`, `previousclose`) y la fecha de `marketdata` se llama `date`, no `datetime`. Mapeé las entidades a los nombres reales.
- El usuario 1 tiene una posición negativa en BMA: hay una venta `FILLED` de 30 acciones cuando solo había comprado 20. Lo tomé como una anomalía de los datos y la muestro tal cual (cantidad −10, valor negativo y rendimiento `null`). Mi API no dejaría crear una orden así.
- Hay dos acciones sin datos de mercado. En la búsqueda aparecen con precio `null`, y se pueden operar con LIMIT pero no con MARKET.

No modifiqué el esquema. No agregué tablas, columnas ni índices, así que la API funciona contra la base tal como la entregaron.

### Sobre los cálculos

- Solo las órdenes `FILLED` mueven pesos y tenencia, como dice el enunciado. Las `NEW` no reservan nada.
- Pesos disponibles = `CASH_IN` + ventas − `CASH_OUT` − compras, usando `size × price` de cada orden.
- Rendimiento total (%) = (último precio − precio promedio de compra) / precio promedio de compra. El enunciado no da la fórmula, así que usé el promedio ponderado por cantidad.
- Valor total de la cuenta = pesos disponibles + valor de mercado de las posiciones.
- El último precio es el `close` de la fecha más reciente de cada activo.
- El retorno diario lo calculo con `close` y `previousClose` y lo devuelvo por activo, en la búsqueda y en el portfolio.
- No uso punto flotante para dinero. Todos los montos, precios y porcentajes se calculan con `decimal.js` y viajan como texto con dos decimales.

### Sobre las órdenes

- **Una orden rechazada devuelve 201, no un error.** Fue la decisión que más pensé. El enunciado pide guardarla en estado `REJECTED`, o sea que el recurso se crea; el rechazo es un estado de la orden, no una falla del pedido. Para que el cliente sepa el motivo agregué `rejectionReason` en la respuesta (`INSUFFICIENT_FUNDS`, `INSUFFICIENT_SHARES` o `AMOUNT_BELOW_PRICE`). No se guarda en la base porque la tabla no tiene una columna para eso.
- Distinto es un pedido inválido (mal formado, o sobre un usuario o activo que no existe): ahí sí devuelvo un error HTTP y no se guarda nada.
- Cuando la orden viene por monto, calculo la máxima cantidad de acciones enteras: `floor(monto / precio)`. Si no alcanza ni para una, queda `REJECTED`. Lo permito tanto en compras como en ventas.
- El precio de la orden es el `close` en MARKET y el precio enviado en LIMIT. Con ese precio valido y guardo.
- ARS no se puede operar. Es el instrumento de tipo `MONEDA` que representa los pesos, así que no aparece en la búsqueda ni como posición.
- No valido horario de mercado ni días hábiles. En un sistema real esa validación existe, pero el enunciado pide no simular el mercado y los precios son de julio de 2023; si la agregaba, la API dejaba de funcionar al probarla fuera de horario.

### Concurrencia

Como los pesos y las acciones disponibles se calculan leyendo las órdenes, había un problema: si un usuario manda dos compras al mismo tiempo, las dos leen el mismo saldo y las dos se aprueban, aunque juntas lo superen.

Lo resolví haciendo la validación y el guardado dentro de una transacción que bloquea la fila del usuario (`SELECT … FOR UPDATE`). La segunda orden espera a que termine la primera y valida contra el saldo ya actualizado. El bloqueo es por usuario, vive en la base (así que funciona aunque haya varias instancias del servicio) y no necesita cambios de esquema.

Hay un test que dispara cinco compras simultáneas para un saldo que alcanza para una sola y verifica que se ejecute exactamente una.

La cancelación es una sola sentencia `UPDATE … WHERE status = 'NEW'`, así que dos cancelaciones simultáneas tampoco pueden aplicarse las dos.

### Por qué sumé el endpoint de cancelación

El enunciado define el estado `CANCELLED` y la regla "solo se pueden cancelar las órdenes con estado `NEW`", pero no pide el endpoint. Lo agregué porque sin él esa regla no se podía probar desde la API.

## Qué le agregaría para producción

Lo dejé afuera a propósito porque excede el enunciado, pero lo tendría en cuenta:

- **Idempotencia.** Si un cliente reintenta un pedido por un corte de red, hoy se crean dos órdenes. Se resuelve con una clave única por pedido (`Idempotency-Key`) guardada con un índice único, pero implica cambiar el esquema y el contrato del endpoint. Por lo tanto, no lo aplique ya que modificaria la base de datos actual que es compartida para el ejercicio.
- **Saldos y posiciones materializados.** Recalcular desde las órdenes está bien para este volumen. Con historiales largos mantendría saldos y posiciones actualizados en la misma transacción que ejecuta cada orden.
- **Reserva de pesos y acciones para las órdenes `NEW`.** Hoy un usuario puede dejar varias órdenes que juntas superen su saldo.
- **Horario de rueda y días hábiles.** Con calendario de feriados y horarios de apertura y cierre.
- **Autenticación y autorización.** Entre otras cosas, para verificar que la orden que se cancela sea de quien la cancela.
- **Índices** en `orders(userid, status)` y `marketdata(instrumentid, date)`.

## Cómo trabajé

Lo desarrollé con Spec-Driven Development y TDD. Antes de cada funcionalidad escribí su especificación con los criterios de aceptación, después el plan técnico y las tareas, y recién ahí el código, siempre con el test primero y un commit por tarea. Todo eso está en la carpeta [`specs/`](specs/) y se puede seguir en el historial de commits.

Si quieren ver el razonamiento que tuve detrás de cada decisión, estos son los archivos más útiles:

- [`specs/domain-context.md`](specs/domain-context.md): el esquema real, los datos, el portfolio del usuario 1 calculado a mano y la lista completa de supuestos.
- [`specs/architecture.md`](specs/architecture.md): las reglas de arquitectura, manejo de dinero y testing.
- Una carpeta por fase: foundation, búsqueda, portfolio, envío de órdenes y cancelación.