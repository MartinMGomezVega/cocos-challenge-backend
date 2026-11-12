# Plan 002 — Portfolio

Cómo se implementa `spec.md`. Respeta `specs/architecture.md`. No agrega dependencias.

## Archivos

```
src/domain/portfolio/account-movement.ts     # instrumentId, side, size, price
src/domain/portfolio/cash-calculator.ts      # calculateAvailableCash(movements): Money
src/domain/portfolio/position-calculator.ts  # calculateHoldings(movements): Holding[]
src/domain/portfolio/portfolio.ts            # valuación: posiciones y valor total
src/application/ports/user.repository.ts     # exists(userId)
src/application/ports/order.repository.ts    # findFilledMovementsByUser(userId)
src/application/ports/instrument.repository.ts   # se agrega findByIds(ids)
src/application/use-cases/get-portfolio.use-case.ts
src/infrastructure/repositories/typeorm-user.repository.ts
src/infrastructure/repositories/typeorm-order.repository.ts
src/infrastructure/repositories/typeorm-instrument.repository.ts   # se agrega findByIds
src/presentation/dto/user-id.param.dto.ts
src/presentation/dto/portfolio.response.dto.ts
src/presentation/controllers/portfolio.controller.ts
src/composition/portfolio.module.ts
test/functional/portfolio.spec.ts
test/support/order-fixtures.ts               # insertar y limpiar órdenes de prueba
http/portfolio.http
```

## Decisiones técnicas

- **Cálculo en el dominio, no en SQL.** El repositorio trae las órdenes `FILLED` del usuario y las fórmulas viven en funciones puras de `domain/portfolio`. Así las reglas del enunciado quedan testeadas sin base y la fase 003 reutiliza exactamente las mismas funciones para validar órdenes.
- **`AccountMovement`:** `{ instrumentId: number; side: 'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'; size: number; price: Decimal }`. Es lo único que el dominio conoce de una orden ejecutada.
- **`calculateAvailableCash`:** suma `size × price` con signo según el `side` y devuelve `Money`.
- **`calculateHoldings`:** devuelve `{ instrumentId, quantity, averageBuyPrice: Decimal | null }` por instrumento, solo con `BUY` y `SELL`, sin las de cantidad 0. No filtra por tipo de instrumento: eso lo hace la valuación, que conoce los instrumentos.
- **Valuación (`portfolio.ts`):** recibe los pesos, las tenencias y los instrumentos con su precio; descarta los de tipo `MONEDA`, calcula valor y rendimientos, ordena por ticker y suma el total.
- **Caso de uso:** verifica que el usuario exista (si no, `DomainError` `NOT_FOUND` con código `USER_NOT_FOUND`), trae los movimientos, calcula, pide los instrumentos involucrados con `findByIds` y arma el portfolio.
- **Consultas:** tres como máximo por pedido (usuario, órdenes `FILLED`, instrumentos con último precio). `findByIds` reutiliza la consulta de la fase 001 para el último precio; con lista vacía no consulta la base.
- **Repositorio de órdenes:** filtra `status = 'FILLED'` y descarta filas con `size` o `price` en `NULL`. Devuelve `AccountMovement`, no entidades.
- **Formato:** los DTOs de respuesta aplican `toFixed2`. El dominio trabaja con `Money` y `Decimal` sin redondear.
- **Fixtures de test:** `order-fixtures.ts` inserta órdenes para un usuario y borra en `afterEach` todas las órdenes con `id > 11`.

## Niveles de test

| Nivel | Archivo | Qué prueba |
|---|---|---|
| Dominio | `cash-calculator.spec.ts` | Las 11 órdenes provistas dan 753000; cada `side`; lista vacía da 0 |
| Dominio | `position-calculator.spec.ts` | Tenencias del usuario 1 (PAMP 40, METR 500, BMA −10); precio promedio ponderado; cantidad 0 excluida |
| Dominio | `portfolio.spec.ts` | Valuación completa del usuario 1 (889756), posición negativa, instrumento sin precio, exclusión de `MONEDA`, orden |
| Caso de uso | `get-portfolio.use-case.spec.ts` | Usuario inexistente, usuario sin órdenes, flujo completo con repositorios falsos |
| Infraestructura | `typeorm-*.repository.int-spec.ts` | Consultas contra la base de test |
| Funcional | `test/functional/portfolio.spec.ts` | CA1 a CA10 por HTTP |

## Nota para el README

Calcular el portfolio leyendo todas las órdenes ejecutadas del usuario es correcto y simple para este volumen. En producción, con historiales largos, se mantendría un saldo y unas posiciones materializadas, actualizadas en la misma transacción que ejecuta cada orden.