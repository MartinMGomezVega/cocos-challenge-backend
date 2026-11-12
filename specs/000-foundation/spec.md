# Spec 000 — Foundation

## Objetivo

Dejar el proyecto listo para desarrollar las funcionalidades con TDD: estructura, herramientas de calidad, conexión a la base, mapeo de las cuatro tablas y base de datos de test aislada.

Esta fase **no expone ningún endpoint de negocio**.

## Alcance

1. Proyecto NestJS con TypeScript `strict`, ESLint y Prettier.
2. Estructura de carpetas horizontal definida en `AGENTS.md`.
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
- La versión de Node se fija en la LTS v26.13.1: archivo `.nvmrc` con `v26.13.1` y campo `"engines": { "node": ">=26.13.1 <27" }` en `package.json`.

### R2. Entidades

- Cada entidad mapea sus columnas a los nombres reales en minúsculas (ver `specs/domain-context.md`, sección 1).
- La propiedad de fecha de `marketdata` mapea a la columna `date`.
- Las columnas `numeric` se exponen como `Decimal` mediante un transformer; `NULL` se conserva como `null`.
- Las entidades viven en `infrastructure/entities` y no se usan fuera de `infrastructure`.

### R3. Money

- Se construye desde `string`, `number` entero o `Decimal`; rechaza valores no numéricos.
- Operaciones: sumar, restar, multiplicar por un entero, comparar.
- `toFixed2()` devuelve un `string` con 2 decimales y redondeo half-up.
- Es inmutable.

### R4. Errores

- `DomainError` es la clase base de los errores de negocio, con un `code` legible.
- Un filtro global convierte cada `DomainError` en una respuesta JSON `{ "code", "message" }` con el status HTTP que corresponda.
- Los errores de validación de DTOs devuelven 400.

### R5. Base de test

- `docker compose up -d db-test` levanta un Postgres local y carga `database/database.sql` al crearse.
- `.env.test` apunta a esa base y se versiona (no contiene secretos).
- El arranque de los tests **aborta** si el host de `DATABASE_URL` contiene `neon.tech`.
- Cada test funcional deja la base como la encontró (transacción con rollback o limpieza de lo insertado).

### R6. Calidad

- Scripts: `start:dev`, `build`, `lint`, `test`, `test:functional`, `test:cov`.
- Umbrales de coverage: 90 % global y 100 % en `src/domain`. Excluidos: `main.ts`, `*.module.ts`, `*.entity.ts`, `*.dto.ts`.

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