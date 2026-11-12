# Tareas 000 — Foundation

Una por vez y en orden. En las tareas marcadas con **TDD**, primero el test en rojo. Un commit por tarea.

- [x] **T1. Scaffold.** Crear el proyecto NestJS con TypeScript `strict`, ESLint y Prettier. Borrar el controller y el service de ejemplo. Crear la estructura de carpetas de `specs/architecture.md`.
  Commit: `chore: scaffold nestjs project`

- [x] **T2. Repo seguro.** `.gitignore` con `.env`, `node_modules`, `dist`, `coverage`. Crear `.env.example` sin valores reales. Crear `.nvmrc` con `26` y agregar `"engines": { "node": ">=26 <27" }` a `package.json` (ver `spec.md` R1). Versionar `database/database.sql`, ya copiado desde el repo de Cocos (no se modifica); `specs/backend-challenge.md` ya está versionado.
  Commit: `chore: add env template and challenge sources`

- [x] **T3. Jest, coverage y lint.** Configurar la suite unitaria (`src/**/*.spec.ts`) y la funcional (`test/functional/*.spec.ts`), los scripts de `spec.md` R6 y los umbrales de coverage. Separar `lint` (verifica, sin `--fix`) de `lint:fix` (corrige). En ESLint, pasar a `error` las reglas `no-explicit-any`, `no-floating-promises` y `no-unsafe-argument`; si eso hace fallar `src/main.ts`, corregir solo la llamada a `bootstrap()` sin `await`.
  Commit: `chore: configure jest, coverage and lint`

- [ ] **T4. Money (TDD).** Tests de construcción, rechazo de valores inválidos, suma, resta, multiplicación por entero, comparación, `toFixed2()` con redondeo half-up e inmutabilidad. Luego `src/domain/shared/money.ts`. Cubre CA7.
  Commit: `feat: add Money value object`

- [ ] **T5. DomainError y filtro (TDD).** Tests de `DomainError` (lleva `code` y `message`) y del filtro (devuelve `{ code, message }` con el status indicado). Luego la implementación.
  Commit: `feat: add domain error and http filter`

- [ ] **T6. Base de test.** `docker-compose.yml` con el servicio `db-test`, `.env.test` y `test/support/assert-safe-database.ts` con su test (TDD): aborta con host `neon.tech`, pasa con `localhost`. Cubre CA8.
  Commit: `chore: add local test database and safety guard`

- [ ] **T7. Configuración y conexión (TDD).** Test de `env.validation.ts`: falla sin `DATABASE_URL`, acepta `PORT` opcional. Luego `database.module.ts` con SSL condicional. Cubre CA1 y CA2.
  Commit: `feat: add validated config and database connection`

- [ ] **T8. Transformer decimal (TDD).** Tests: `"930.00"` → `Decimal(930)`, `null` → `null`, y el camino inverso.
  Commit: `feat: add decimal column transformer`

- [ ] **T9. Entidades (TDD).** Tests contra la base de test para CA3, CA4, CA5 y CA6. Luego las cuatro entidades. Si los datos locales no coinciden con `specs/domain-context.md`, frenar y avisar.
  Commit: `feat: map database entities`

- [ ] **T10. Arranque de la app.** `main.ts` con versionado URI `/v1`, `ValidationPipe` global y el filtro de errores. `test/support/test-app.ts` para los tests funcionales.
  Commit: `feat: bootstrap app with versioning and validation`

- [ ] **T11. Verificación final.** Correr `npm run lint`, `npm test`, `npm run test:functional` y `npm run test:cov`. Verificar CA10 con `git grep -i neon` y `git grep npg_`. Cubre CA9 y CA10.
  Commit: `chore: verify foundation acceptance criteria`