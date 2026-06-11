import { Test, TestingModule } from '@nestjs/testing';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PagosService } from './pagos.service';
import { PagosRepository } from './repositories/pagos.repository';
import { CuotasRepository } from './repositories/cuotas.repository';
import { HistorialCobranzaRepository } from './repositories/historial-cobranza.repository';
import { MoraService } from './mora.service';

const LOAN_ID = '550e8400-e29b-41d4-a716-446655440000';
const PAGO_ID = '660e8400-e29b-41d4-a716-446655440111';
const CUOTA_ID = '770e8400-e29b-41d4-a716-446655440222';

// Total adeudado fijo para los tests (1 cuota vencida con saldo 1000).
const TOTAL_ADEUDADO = 1000;

describe('PagosService.imputar — es_parcial', () => {
  let service: PagosService;

  const mockPagosRepository = {
    findByIdForUpdate: jest.fn(),
    getSumsForCuota: jest.fn(),
    insertPagoCuota: jest.fn(),
    markImputado: jest.fn(),
  };
  const mockCuotasRepository = {
    findByLoanIdForUpdate: jest.fn(),
    updateSaldoAndEstado: jest.fn(),
  };
  const mockHistorialRepository = {
    insert: jest.fn(),
  };
  const mockMoraService = {
    getLoanWithTNA: jest.fn(),
    calcularDPD: jest.fn(),
    calcularMoraParaCuota: jest.fn(),
  };
  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  const zeroSums = {
    sum_mora_aplicada: 0,
    sum_iva_mora_aplicada: 0,
    sum_interes_aplicado: 0,
    sum_iva_interes_aplicado: 0,
    sum_capital_aplicado: 0,
  };

  // Cuota vencida con todo el saldo en capital (sin mora) para simplificar.
  const cuota = {
    id: CUOTA_ID,
    loan_id: LOAN_ID,
    numero_cuota: 1,
    fecha_vencimiento: '2026-05-01',
    estado: 'vencida',
    capital: TOTAL_ADEUDADO,
    interes: 0,
    iva_interes: 0,
    total_cuota: TOTAL_ADEUDADO,
    saldo_pendiente: TOTAL_ADEUDADO,
  };

  function setupImputarScenario(monto: number): void {
    mockPagosRepository.findByIdForUpdate.mockResolvedValue({
      id: PAGO_ID,
      loan_id: LOAN_ID,
      estado: 'validado',
      imputado: false,
      monto,
    });
    mockMoraService.getLoanWithTNA.mockResolvedValue({
      id: LOAN_ID,
      public_loan_number: 'L-1',
      disbursed_at: new Date('2026-04-01'),
      tasa_nominal_anual: 100,
    });
    mockCuotasRepository.findByLoanIdForUpdate.mockResolvedValue([cuota]);
    mockPagosRepository.getSumsForCuota.mockResolvedValue(zeroSums);
    mockMoraService.calcularDPD.mockReturnValue(10);
    // Sin mora: total adeudado = capital pendiente (1000).
    mockMoraService.calcularMoraParaCuota.mockReturnValue({
      dpd: 10,
      capital_vencido_impago: TOTAL_ADEUDADO,
      interes_pendiente: 0,
      iva_interes_pendiente: 0,
      mora_base: 0,
      iva_mora: 0,
      total_mora: 0,
      saldo_actualizado: TOTAL_ADEUDADO,
      es_bonificable: false,
      es_solapada: false,
    });
    mockPagosRepository.insertPagoCuota.mockResolvedValue({});
    mockCuotasRepository.updateSaldoAndEstado.mockResolvedValue(undefined);
    mockHistorialRepository.insert.mockResolvedValue(undefined);
    mockPagosRepository.markImputado.mockResolvedValue(undefined);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockClient = { query: jest.fn() };
    mockDbService.withTransaction.mockImplementation(
      async (fn: (client: PoolClient) => Promise<unknown>) => {
        return fn(mockClient as unknown as PoolClient);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: DbService, useValue: mockDbService },
        { provide: PagosRepository, useValue: mockPagosRepository },
        { provide: CuotasRepository, useValue: mockCuotasRepository },
        {
          provide: HistorialCobranzaRepository,
          useValue: mockHistorialRepository,
        },
        { provide: MoraService, useValue: mockMoraService },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
  });

  it('marca es_parcial=true cuando el pago no cubre el total adeudado', async () => {
    setupImputarScenario(500); // 500 < 1000

    await service.imputar(PAGO_ID, 'sistema_automatico');

    expect(mockPagosRepository.markImputado).toHaveBeenCalledWith(
      expect.anything(),
      PAGO_ID,
      true,
    );
  });

  it('marca es_parcial=false cuando el pago cubre la totalidad del total adeudado', async () => {
    setupImputarScenario(TOTAL_ADEUDADO); // 1000 >= 1000

    await service.imputar(PAGO_ID, 'sistema_automatico');

    expect(mockPagosRepository.markImputado).toHaveBeenCalledWith(
      expect.anything(),
      PAGO_ID,
      false,
    );
  });
});
