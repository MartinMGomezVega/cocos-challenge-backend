# Spec 000 — Foundation

## Objetivo

Dejar el proyecto listo para desarrollar las funcionalidades con TDD: estructura, herramientas de calidad, conexión a la base, mapeo de las cuatro tablas y base de datos de test aislada.

Esta fase **no expone ningún endpoint de negocio**.

## Alcance

1. Proyecto NestJS con TypeScript `strict`, ESLint y Prettier.
2. Estructura de carpetas horizontal definida en `specs/architecture.md`.
3. Configuración por variables de entorno, validada al arrancar.
4. Conexión a PostgreSQL con TypeORM (`synchronize: false`).
5. Entidades TypeORM para `users`, `instruments`, `orders` y `marketdata`.
6. Value object `Money` en el dominio.
7. Error de dominio base y filtro que lo traduce a HTTP.
8. Base de test local con Docker, cargada con `database/database.sql`.
9. Jest configurado con dos suites (unitaria y funcional) y umbrales de coverage.
10. Versionado de la API con prefijo `/v1` y validación global de DTOs.

## Fuera de alcance

- Casos de uso, controllers y repositorios de negocio (fases 001 a 004).
- Autenticación, Swagger, migraciones, cambios de esquema, CI.

## Requisitos

### R1. Configuración

- Variables: `DATABASE_URL` (obligatoria) y `PORT` (opcional, por defecto 3000).
- Si falta `DATABASE_URL`, la app no arranca y muestra un error claro.
- `.env` está en `.gitignore`. `.env.example` lista las variables sin valores reales.
- La conexión usa SSL cuando el host no es local.
- La versión de Node se fija en la LTS 26: archivo `.nvmrc` con `26` y campo `"engines": { "node": ">=26 <27" }` en `package.json`.

### R2. Entidades

- Cada entidad mapea sus columnas a los nombres reales en minúsculas (ver `specs/domain-context.md`, sección 1).
- La propiedad de fecha de `marketdata` mapea a la columna `date`.
- Las columnas `numeric` se exponen como `Decimal` mediante un transformer; `NULL` se conserva como `null`.
- Las entidades viven en `infrastructure/entities` y no se usan fuera de `infrastructure`.

### R3. Money

- Constructor privado. Fábricas estáticas: `Money.from(value: string | number | Decimal)` y `Money.zero()`.
- Validación en `from()`: acepta `number` solo si `Number.isSafeInteger`; acepta `string` solo si cumple `/^-?\d+(\.\d+)?$/`; acepta `Decimal` solo si es finito (`isFinite()`). Cualquier otro valor lanza `Error` con un mensaje claro. Los valores negativos son válidos.
- Operaciones: `add(other: Money)`, `subtract(other: Money)`, `multiply(factor: number)`. `multiply` lanza `Error` si `factor` no es un entero seguro (`Number.isSafeInteger`). Todas devuelven una instancia nueva (inmutable).
- Comparación: `equals(other: Money)`, `greaterThan(other: Money)`, `greaterThanOrEqual(other: Money)`, `lessThan(other: Money)`.
- Lectura: `toDecimal(): Decimal` y `toFixed2(): string`.
- Guarda precisión completa internamente; solo redondea en `toFixed2()`.
- `toFixed2()` devuelve un `string` con 2 decimales y redondeo half-up pasando `Decimal.ROUND_HALF_UP` como argumento (sin modificar la configuración global `Decimal.set`). Los empates se alejan del cero (`0.005` → `"0.01"`, `-0.005` → `"-0.01"`) y nunca devuelve `"-0.00"` (`-0.004` → `"0.00"`).

### R4. Errores

- `DomainError` es la clase base de los errores de negocio, con `code` (string legible), `message` y `kind`.
- `kind` es una de cuatro categorías agnósticas de HTTP: `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`. El dominio no conoce códigos HTTP.
- Un filtro global (`DomainErrorFilter` en `src/presentation/filters`) convierte cada `DomainError` en una respuesta JSON `{ "code", "message" }` traduciendo `kind` a status HTTP: `VALIDATION` → 400, `NOT_FOUND` → 404, `CONFLICT` → 409, `UNPROCESSABLE` → 422.
- Los errores de validación de DTOs devuelven 400.

### R5. Base de test

- `docker compose up -d db-test` levanta un Postgres local y carga `database/database.sql` al crearse.
- `.env.test` apunta a esa base y se versiona (no contiene secretos).
- El arranque de los tests **aborta** si `DATABASE_URL` no está definida o si el host contiene `neon.tech` (`test/support/assert-safe-database.ts` como función pura y `test/support/global-setup.ts` conectado al `globalSetup` de ambas suites de Jest, cargando `.env.test` con `process.loadEnvFile` cuando `DATABASE_URL` no está definida).
- Cada test que toca la base deja la base como la encontró (transacción con rollback o limpieza de lo insertado).
- Los tests que necesitan la base (`src/infrastructure/**/*.int-spec.ts` y `test/functional/*.spec.ts`) corren en serie (`maxWorkers: 1`) porque comparten la base de test.

### R6. Calidad

- Scripts: `start:dev`, `build`, `lint`, `lint:fix`, `test`, `test:functional`, `test:cov`.
- `npm test`: corre solo tests unitarios puros (`src/**/*.spec.ts` y `test/support/**/*.spec.ts`), sin requerir Docker.
- `npm run test:functional`: corre los tests que usan la base local (`src/**/*.int-spec.ts` y `test/functional/*.spec.ts`), en serie.
- `npm run test:cov`: corre todos los tests (unitarios + integración + funcionales) y aplica los umbrales sobre el coverage combinado de `src`.
- `lint` solo verifica (sin `--fix`); `lint:fix` corrige.
- ESLint marca como **error** `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises` y `@typescript-eslint/no-unsafe-argument`.
- Umbrales de coverage: 90 % global y 100 % en `src/domain`. Excluidos: `main.ts`, `*.module.ts`, `*.entity.ts`, `*.dto.ts`, `*.spec.ts`, `*.int-spec.ts`.

## Criterios de aceptación

| # | Criterio |
|---|---|
| CA1 | `npm run start:dev` arranca y se conecta a la base indicada en `.env`. |
| CA2 | Sin `DATABASE_URL`, la app falla al arrancar con un mensaje que nombra la variable. |
| CA3 | Contra la base de test, las entidades leen: 4 usuarios, 66 instrumentos, 11 órdenes y 126 filas de marketdata. |
| CA4 | La orden 2 se lee con `instrumentId = 47`, `userId = 1`, `size = 50` y `price` como `Decimal` igual a 930. |
| CA5 | La fila de marketdata del instrumento 47 con fecha 2023-07-14 se lee con `close = 925.85` y `previousClose = 921.80`. |
| CA6 | Una fila de marketdata con `high` en `NULL` se lee con `high = null`, sin error. |
| CA7 | `Money` cumple R3, con 100 % de coverage. |
| CA8 | Los tests no arrancan si `DATABASE_URL` apunta a `neon.tech`. |
| CA9 | `npm run lint`, `npm test` y `npm run test:functional` pasan; `npm run test:cov` cumple los umbrales. |
| CA10 | `git grep` no encuentra la contraseña ni el host de Neon en el repo. |