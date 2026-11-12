# Plan 000 — Foundation

Cómo se implementa `spec.md`. Respeta `specs/architecture.md`.

## Dependencias

| Paquete | Para qué |
|---|---|
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` (`^11`) | Framework |
| `reflect-metadata`, `rxjs` | Dependencias obligatorias (peer) de NestJS |
| `@nestjs/config` (`^4`) | Variables de entorno |
| `@nestjs/typeorm` (`^11`), `typeorm` (`^0.3`), `pg` (`^8`) | Acceso a datos |
| `decimal.js` (`^10`) | Dinero y porcentajes |
| `class-validator` (`^0.15`), `class-transformer` (`^0.5`) | Validación de DTOs y de la configuración |
| `typescript`, `@nestjs/cli`, `@nestjs/schematics` (dev) | Compilación, `nest build` / `nest start` y `nest-cli.json` |
| `jest`, `ts-jest`, `supertest`, `@nestjs/testing` (dev) | Tests |
| `ts-node` (dev) | Necesario para que Jest lea `jest.config.ts` |
| `eslint`, `prettier` (dev) | Calidad |
| `typescript-eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `eslint-plugin-prettier` (dev) | Configuración de ESLint para TypeScript + Prettier |
| `@types/node`, `@types/express`, `@types/jest`, `@types/supertest`, `@types/pg` (dev) | Tipos |

## Archivos a crear

```
.nvmrc                                # versión de Node LTS (26)
.env.example
.env.test
.gitignore
docker-compose.yml
database/database.sql                 # copiado del repo de Cocos
jest.config.ts                        # suite unitaria + umbrales de coverage
test/jest-functional.config.ts        # suite con base local (*.int-spec.ts + test/functional/*.spec.ts)
test/jest-cov.config.ts               # suite completa para coverage combinado de src
test/support/assert-safe-database.ts  # función pura: aborta sin DATABASE_URL o si el host es neon.tech
test/support/global-setup.ts          # globalSetup de Jest: carga .env.test y ejecuta assertSafeDatabase
test/support/test-app.ts              # arma la app Nest para tests
src/main.ts
src/app.module.ts
src/domain/shared/money.ts
src/domain/shared/domain-error.ts
src/infrastructure/database/env.validation.ts
src/infrastructure/database/database.module.ts
src/infrastructure/database/decimal.transformer.ts
src/infrastructure/entities/user.entity.ts
src/infrastructure/entities/instrument.entity.ts
src/infrastructure/entities/order.entity.ts
src/infrastructure/entities/market-data.entity.ts
src/presentation/configure-app.ts
src/presentation/filters/domain-error.filter.ts
```

## Decisiones técnicas

- **Versionado:** `app.enableVersioning({ type: VersioningType.URI })` con versión por defecto `1`, para que todas las rutas queden bajo `/v1`.
- **Validación global:** `ValidationPipe` con `whitelist`, `forbidNonWhitelisted` y `transform`.
- **Configuración:** `ConfigModule.forRoot` con una función `validate` que exige `DATABASE_URL`. En tests carga `.env.test`.
- **SSL:** activado salvo que el host sea `localhost` o `127.0.0.1`.
- **Transformer decimal:** `from: (v) => v === null ? null : new Decimal(v)`, `to: (v) => v === null ? null : v.toString()`.
- **Mapeo de columnas:** `@Column({ name: 'instrumentid' })` en cada propiedad camelCase; `@PrimaryGeneratedColumn()` para `id`.
- **Base de test:** servicio `db-test` en `docker-compose.yml` con imagen `postgres:16`, puerto 5433, y `database/database.sql` montado en `/docker-entrypoint-initdb.d/`.
- **Guardia de seguridad:** `global-setup.ts` se ejecuta en el `globalSetup` de ambas suites, carga `.env.test` si `DATABASE_URL` no está definida y llama a la función pura `assertSafeDatabase` (`assert-safe-database.ts`).
- **Aislamiento:** los tests que escriben borran en `afterEach` las filas con `id` mayor al máximo de los datos provistos (órdenes con `id > 11`).

## Riesgo a verificar

El `database.sql` del repo de Cocos puede no coincidir exactamente con la base de Neon. Tras cargarlo en local, comparar contra `specs/domain-context.md` (CA3, CA4, CA5). Si difiere, frenar y avisar antes de seguir.