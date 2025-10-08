import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/prisma.service';

import { CreateSolicitudDto } from './dtos/create-solicitud.dto';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    financiera_solicitudes: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    financiera_clientes: {
      findUnique: jest.fn(),
    },
    financiera_garantes: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new solicitud', async () => {
      const createSolicitudDto: CreateSolicitudDto = {
        cliente_id: 'test-cliente-id',
        monto_solicitado: 100000,
        plazo_meses: 24,
        proposito: 'Compra de vehículo',
        estado: 'pendiente',
      };

      const mockCliente = {
        id: 'test-cliente-id',
        persona_id: 'test-persona-id',
        estado: 'activo',
      };

      const expectedSolicitud = {
        id: 'test-solicitud-id',
        ...createSolicitudDto,
        cliente: {
          ...mockCliente,
          persona: { id: 'test-persona-id' },
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(mockCliente);
      mockPrismaService.financiera_solicitudes.create.mockResolvedValue(expectedSolicitud);

      const result = await service.create(createSolicitudDto);

      expect(mockPrismaService.financiera_clientes.findUnique).toHaveBeenCalledWith({
        where: { id: createSolicitudDto.cliente_id },
      });
      expect(mockPrismaService.financiera_solicitudes.create).toHaveBeenCalledWith({
        data: createSolicitudDto,
        include: {
          cliente: {
            include: {
              persona: true,
            },
          },
          solicitud_garantes: {
            include: {
              garante: {
                include: {
                  persona: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(expectedSolicitud);
    });
  });

  describe('findAll', () => {
    it('should return all solicitudes', async () => {
      const expectedSolicitudes = [
        {
          id: 'solicitud-1',
          cliente_id: 'cliente-1',
          monto_solicitado: 100000,
          plazo_meses: 24,
          proposito: 'Compra de vehículo',
          estado: 'pendiente',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'solicitud-2',
          cliente_id: 'cliente-2',
          monto_solicitado: 200000,
          plazo_meses: 36,
          proposito: 'Mejoras en el hogar',
          estado: 'en_revision',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.financiera_solicitudes.findMany.mockResolvedValue(expectedSolicitudes);

      const result = await service.findAll();

      expect(mockPrismaService.financiera_solicitudes.findMany).toHaveBeenCalled();
      expect(result).toEqual(expectedSolicitudes);
    });
  });

  describe('findOne', () => {
    it('should return a solicitud by id', async () => {
      const solicitudId = 'test-solicitud-id';
      const expectedSolicitud = {
        id: solicitudId,
        cliente_id: 'test-cliente-id',
        monto_solicitado: 100000,
        plazo_meses: 24,
        proposito: 'Compra de vehículo',
        estado: 'pendiente',
        cliente: {
          id: 'test-cliente-id',
          persona: { id: 'test-persona-id' },
        },
        evaluaciones: [],
        prestamos: [],
        solicitud_garantes: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_solicitudes.findUnique.mockResolvedValue(expectedSolicitud);

      const result = await service.findOne(solicitudId);

      expect(mockPrismaService.financiera_solicitudes.findUnique).toHaveBeenCalledWith({
        where: { id: solicitudId },
        include: {
          cliente: {
            include: {
              persona: true,
            },
          },
          evaluaciones: true,
          prestamos: true,
          solicitud_garantes: {
            include: {
              garante: {
                include: {
                  persona: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(expectedSolicitud);
    });
  });

  describe('update', () => {
    it('should update a solicitud', async () => {
      const solicitudId = 'test-solicitud-id';
      const updateData = {
        estado: 'aprobada',
        proposito: 'Compra de vehículo actualizada',
      };

      const expectedSolicitud = {
        id: solicitudId,
        cliente_id: 'test-cliente-id',
        monto_solicitado: 100000,
        plazo_meses: 24,
        proposito: 'Compra de vehículo actualizada',
        estado: 'aprobada',
        cliente: {
          id: 'test-cliente-id',
          persona: { id: 'test-persona-id' },
        },
        solicitud_garantes: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_solicitudes.update.mockResolvedValue(expectedSolicitud);

      const result = await service.update(solicitudId, updateData);

      expect(mockPrismaService.financiera_solicitudes.update).toHaveBeenCalledWith({
        where: { id: solicitudId },
        data: updateData,
        include: {
          cliente: {
            include: {
              persona: true,
            },
          },
          solicitud_garantes: {
            include: {
              garante: {
                include: {
                  persona: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(expectedSolicitud);
    });
  });
});
