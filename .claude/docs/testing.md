# Testing — zaga-backend

## Estructura general

```
src/
  **/*.spec.ts          ← unit tests (co-localizados con el código)
test/
  *.e2e-spec.ts         ← e2e tests
  jest-e2e.json         ← config Jest para e2e
```

---

## Unit tests (`npm run test`)

### Dónde viven
Co-localizados junto al archivo que testean: `contracts.service.ts` → `contracts.service.spec.ts`.

### Qué se testea con unit tests
- Lógica de negocio en servicios (flujos de estado, reglas de validación, cálculos).
- Utilidades puras (`case-requested-amount.ts`, `cuit-checksum.ts`, `zaga-token.util.ts`).
- Comportamiento de controladores cuando el servicio devuelve resultados esperados o lanza excepciones.
- Jobs (`contracts-expiration.service.spec.ts`).

### Patrón estándar

```typescript
describe('MiServicio', () => {
  let service: MiServicio;

  const mockRepositorio = {
    metodo: jest.fn(),
  };

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(async (fn) => fn(mockClient)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MiServicio,
        { provide: MiRepositorio, useValue: mockRepositorio },
        { provide: DbService, useValue: mockDbService },
      ],
    }).compile();

    service = module.get(MiServicio);
  });
});
```

### Qué NO se mockea en unit tests
- El servicio bajo test (es el que se instancia real).
- Utilidades sin dependencias externas (funciones puras).

### Qué SÍ se mockea
- `DbService` — siempre, con `query` y `withTransaction` como `jest.fn()`.
- Repositorios — siempre, con sus métodos como `jest.fn()`.
- Servicios externos (`SignaturaService`, `PostSignatureWebhookService`, `ConfigService`).
- `fetch` global — con `jest.spyOn(globalThis, 'fetch')` cuando el servicio hace HTTP.

### Cuándo agregar unit tests
- Siempre que se agregue lógica de negocio en un servicio.
- Para cada rama significativa: flujo feliz, caso no encontrado, transición de estado inválida, error de BD mapeado a excepción HTTP.
- Para utilidades de cálculo o transformación (100% de cobertura de ramas).

---

## E2E tests (`npm run test:e2e`)

### Dónde viven
`test/*.e2e-spec.ts`. Config en `test/jest-e2e.json`.

### Qué se testea con e2e
- Que el endpoint HTTP completo (validación de DTO → servicio → respuesta) funciona.
- Que `ValidationPipe` rechaza inputs inválidos con 400.
- Que el flujo end-to-end de un caso de negocio devuelve la respuesta correcta.
- Idempotencia y casos límite de flujos críticos (contratos, firma, webhook).

### Archivos actuales

| Archivo | Cubre |
|---------|-------|
| `app.e2e-spec.ts` | Smoke test: `GET /` devuelve 200 |
| `prequal.e2e-spec.ts` | `POST /prequal/run` — body válido/inválido, usuario inexistente |
| `cases-from-requested-amount.e2e-spec.ts` | `POST /cases/create-from-requested-amount` — happy path y variantes |
| `contracts.e2e-spec.ts` | Webhook Signatura — firma OK, firma fallida, idempotencia |

### Patrón estándar

```typescript
describe('MiController (e2e)', () => {
  let app: INestApplication;

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Configurar mocks del DbService según el caso

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(mockDbService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });
});
```

### Decisiones de diseño en e2e
- **`DbService` se mockea siempre** en e2e. Los tests no tocan la base de datos real.
- **HTTP externo (BCRA, Signatura) se mockea** con `jest.spyOn(globalThis, 'fetch')`.
- **`AppModule` completo** se importa (no módulos parciales) para probar la cadena real de pipes, guards y providers.
- **`ValidationPipe` se registra explícitamente** en cada test de e2e (no asumirlo del bootstrap).
- **`rawBody: true`** no es necesario en tests porque el webhook se llama directamente al servicio, no vía HTTP con HMAC.

### Cuándo agregar e2e tests
- Al agregar un endpoint nuevo: al menos happy path + un caso de validación 400.
- Al cambiar flujos que involucren contratos o cobranzas.
- Al modificar guards o pipes globales.

---

## Criterio de cobertura

No hay % de cobertura obligatorio configurado. La heurística es:

- **Servicios con lógica de estado** (contracts, cases, prequal, cobranzas): unit + e2e.
- **Repositorios**: no se testean directamente (SQL raw sin lógica de negocio).
- **Controladores sin lógica propia**: test de controller solo si delega a un servicio que puede lanzar excepciones distintas.
- **Utilidades puras**: unit test siempre.

---

## Comandos

```bash
npm run test              # unit tests
npm run test:watch        # unit tests en modo watch
npm run test:cov          # unit tests con reporte de cobertura
npm run test:e2e          # e2e tests
```
