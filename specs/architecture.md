# Arquitectura

Reglas técnicas del proyecto: stack, arquitectura, API, base de datos, manejo de dinero y TDD.

## 1. Stack

- Node.js LTS + NestJS + TypeScript en modo `strict`.
- PostgreSQL con TypeORM (`synchronize: false`, sin migraciones: el esquema provisto no se modifica).
- `decimal.js` para todo cálculo con dinero, precios o porcentajes.
- `class-validator` / `class-transformer` para validar DTOs.
- Jest + Supertest para tests.

No agregar librerías fuera de esta lista sin pedir aprobación.

## 2. Arquitectura: horizontal, con Clean Architecture

```
src/
├── domain/            # reglas puras; agrupado por shared/, instruments/, portfolio/, orders/
├── application/
│   ├── ports/         # interfaces de repositorios
│   └── use-cases/     # un archivo por caso de uso
├── infrastructure/
│   ├── database/      # configuración de TypeORM
│   ├── entities/      # *.entity.ts
│   └── repositories/  # implementaciones TypeORM de los puertos
├── presentation/
│   ├── controllers/
│   ├── dto/
│   └── filters/       # errores de dominio → HTTP
└── composition/       # módulos NestJS que conectan puertos, repositorios, casos de uso y controllers
test/
├── functional/        # tests HTTP de punta a punta
└── support/           # arranque de la base de test
```

Regla de dependencias (obligatoria):

- `domain` no importa nada de NestJS, TypeORM ni de otras capas.
- `application` solo importa de `domain`.
- `infrastructure` implementa los puertos de `application`.
- `presentation` solo llama a casos de uso; no contiene lógica de negocio ni accede a repositorios.

## 3. API

Prefijo de versión `/v1`. Solo existen estos cuatro endpoints:

| Método y ruta | Caso de uso |
|---|---|
| `GET /v1/users/:userId/portfolio` | Portfolio del usuario |
| `GET /v1/instruments?query=` | Buscar activos por ticker y/o nombre |
| `POST /v1/orders` | Enviar una orden |
| `PATCH /v1/orders/:orderId/cancel` | Cancelar una orden en estado `NEW` |

No hay autenticación (lo indica el enunciado).

## 4. Base de datos

- Columnas en minúsculas: `instrumentid`, `userid`, `previousclose`, `accountnumber`. Mapear cada propiedad camelCase con `@Column({ name: '...' })`.
- La fecha de `marketdata` es la columna `date` (tipo `DATE`), no `datetime`.
- Las columnas `numeric` llegan como `string`: convertir a `Decimal` con un transformer; nunca a `number`.
- Los `id` se generan por secuencia.
- **Prohibido** crear, alterar o borrar tablas, columnas o índices.

## 5. Dinero y números

- Nunca usar `number` para dinero, precios o porcentajes; siempre `Decimal`.
- `size` es entero: no existen fracciones de acciones.
- En las respuestas JSON, montos y porcentajes van como `string` con 2 decimales (redondeo half-up). Las cantidades de acciones van como `number` entero.

## 6. TDD (obligatorio)

Ciclo por cada tarea: **test en rojo → código mínimo en verde → refactor**. No se escribe código de producción sin un test que falle primero.

| Nivel | Ubicación | Con qué |
|---|---|---|
| Dominio | `src/domain/**/*.spec.ts` | Tests puros, sin mocks |
| Casos de uso | `src/application/**/*.spec.ts` | Repositorios falsos en memoria |
| Infraestructura (unitarios) | `src/infrastructure/**/*.spec.ts` | Tests puros, sin Docker |
| Infraestructura (base de datos) | `src/infrastructure/**/*.int-spec.ts` | Postgres local |
| Funcional | `test/functional/*.spec.ts` | Supertest + Postgres local |

Coverage mínimo (el build falla si baja): 90 % global, 100 % en `src/domain`, calculado sobre el coverage combinado de `src` (excluidos: `main.ts`, `*.module.ts`, `*.entity.ts`, `*.dto.ts`, `*.spec.ts`, `*.int-spec.ts`).
