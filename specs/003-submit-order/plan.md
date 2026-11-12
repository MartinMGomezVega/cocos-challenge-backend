# Plan 003 — Enviar una orden

Cómo se implementa `spec.md`. Respeta `specs/architecture.md`. No agrega dependencias.

## Archivos

```
src/domain/orders/order.ts                   # Order, OrderSide, OrderType, OrderStatus, RejectionReason
src/domain/orders/order-decision.ts          # decideOrder(input): decisión pura
src/application/ports/order.repository.ts    # se agrega submitAtomically
src/application/ports/instrument.repository.ts   # se agrega findById
src/application/use-cases/submit-order.use-case.ts
src/infrastructure/repositories/typeorm-order.repository.ts   # se agrega submitAtomically
src/infrastructure/repositories/typeorm-instrument.repository.ts   # se agrega findById
src/presentation/dto/submit-order.body.dto.ts
src/presentation/dto/order.response.dto.ts
src/presentation/controllers/orders.controller.ts
src/composition/orders.module.ts
test/functional/orders.spec.ts               # el test funcional que pide el enunciado
http/orders.http
```

## Decisiones técnicas

### La decisión es una función pura del dominio

`decideOrder` recibe todo lo necesario y no consulta nada:

```
decideOrder({
  side, type,
  size?: number, amount?: Decimal, limitPrice?: Decimal,
  marketPrice: Decimal | null,
  movements: AccountMovement[],      // órdenes FILLED del usuario
  instrumentId,
}) → { size, price, status, rejectionReason }
```

- Aplica R3, R4 y R5 de la spec en ese orden.
- Usa `calculateAvailableCash` y `calculateHoldings` de la fase 002; no duplica fórmulas.
- Con `type` `MARKET` y `marketPrice` `null` lanza `DomainError` `UNPROCESSABLE` con código `MARKET_PRICE_UNAVAILABLE`.
- Todos los casos de CA1 a CA17 se prueban acá sin base de datos.

### El caso de uso orquesta

1. Verifica que el usuario exista (`USER_NOT_FOUND`).
2. Busca el instrumento con su último precio (`INSTRUMENT_NOT_FOUND`).
3. Rechaza los de tipo `MONEDA` (`INSTRUMENT_NOT_TRADABLE`).
4. Rechaza `MARKET` sin precio (`MARKET_PRICE_UNAVAILABLE`), antes de abrir la transacción.
5. Llama a `orderRepository.submitAtomically(userId, decide)`, donde `decide` es una función que recibe los movimientos `FILLED` y devuelve la decisión.

### Atomicidad por usuario (R7)

`submitAtomically(userId, decide)` hace todo dentro de **una transacción**:

1. `SELECT id FROM users WHERE id = $1 FOR UPDATE`: bloquea la fila del usuario. Otra orden del mismo usuario espera hasta que esta termine.
2. Lee los movimientos `FILLED` del usuario.
3. Ejecuta `decide(movements)`.
4. Inserta la orden con `RETURNING`.
5. Confirma la transacción y devuelve la orden grabada.

- Si `decide` lanza un error, la transacción se revierte y no se graba nada.
- El bloqueo es por usuario: órdenes de usuarios distintos no se esperan entre sí.
- No requiere cambios de esquema.

### Fecha en UTC

La columna `datetime` es `timestamp without time zone`. El driver `pg` convierte un `Date` a la zona horaria local del proceso, así que hay que grabar el valor en UTC de forma explícita (por ejemplo, enviando el texto ISO en UTC o con `timezone('utc', now())`). Al leer, el valor se interpreta como UTC. Hay un test que lo verifica.

### Validación de entrada

- DTO con `class-validator`. `amount` y `price`: `@IsNumber({ maxDecimalPlaces: 2 })` y `@IsPositive()`. Se convierten a `Decimal` desde su representación en texto, nunca operando con `number`.
- Las reglas cruzadas ("exactamente uno entre `size` y `amount`", "`price` según `type`") se validan en el DTO, para que devuelvan 400 antes de llegar al caso de uso.

### Errores

| Código | `kind` |
|---|---|
| `USER_NOT_FOUND`, `INSTRUMENT_NOT_FOUND` | `NOT_FOUND` |
| `INSTRUMENT_NOT_TRADABLE` | `VALIDATION` |
| `MARKET_PRICE_UNAVAILABLE` | `UNPROCESSABLE` |

## Niveles de test

| Nivel | Archivo | Qué prueba |
|---|---|---|
| Dominio | `order-decision.spec.ts` | Todas las reglas de R3 a R5, con los límites exactos (813 y 814 PAMP, 40 y 41 PAMP) |
| Caso de uso | `submit-order.use-case.spec.ts` | Los cuatro errores previos y que la decisión llega al puerto |
| Infraestructura | `typeorm-order.repository.int-spec.ts` | Inserción, reversión ante error, fecha en UTC y bloqueo por usuario |
| Funcional | `test/functional/orders.spec.ts` | CA1 a CA29 por HTTP |

## Consideraciones para producción

El bloqueo de la fila del usuario serializa sus órdenes y evita el doble gasto sin tocar el esquema. En producción se complementaría con una clave de idempotencia por pedido, para que un reintento del cliente no genere dos órdenes.