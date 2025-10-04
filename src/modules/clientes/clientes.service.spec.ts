import { Test, TestingModule } from '@nestjs/testing';
import { ClientesService } from './clientes.service';
import { PrismaService } from '@shared/prisma.service';
import { CreateClienteDto } from './dtos/create-cliente.dto';

describe('ClientesService', () => {
  let service: ClientesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    financiera_clientes: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new cliente', async () => {
      const createClienteDto: CreateClienteDto = {
        persona_id: 'test-persona-id',
        estado: 'activo',
      };

      const expectedCliente = {
        id: 'test-cliente-id',
        ...createClienteDto,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_clientes.create.mockResolvedValue(expectedCliente);

      const result = await service.create(createClienteDto);

      expect(mockPrismaService.financiera_clientes.create).toHaveBeenCalledWith({
        data: createClienteDto,
        include: {
          persona: true,
        },
      });
      expect(result).toEqual(expectedCliente);
    });
  });

  describe('findAll', () => {
    it('should return all clientes', async () => {
      const expectedClientes = [
        {
          id: 'cliente-1',
          persona_id: 'persona-1',
          email: 'test1@example.com',
          telefono: '+54911234567',
          direccion: 'Test Address 1',
          fecha_nacimiento: new Date('1990-01-01'),
          ocupacion: 'Developer',
          ingresos_mensuales: 50000,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'cliente-2',
          persona_id: 'persona-2',
          email: 'test2@example.com',
          telefono: '+54911234568',
          direccion: 'Test Address 2',
          fecha_nacimiento: new Date('1991-01-01'),
          ocupacion: 'Designer',
          ingresos_mensuales: 45000,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPrismaService.financiera_clientes.findMany.mockResolvedValue(expectedClientes);

      const result = await service.findAll();

      expect(mockPrismaService.financiera_clientes.findMany).toHaveBeenCalled();
      expect(result).toEqual(expectedClientes);
    });
  });

  describe('findOne', () => {
    it('should return a cliente by id', async () => {
      const clienteId = 'test-cliente-id';
      const expectedCliente = {
        id: clienteId,
        persona_id: 'test-persona-id',
        email: 'test@example.com',
        telefono: '+54911234567',
        direccion: 'Test Address 123',
        fecha_nacimiento: new Date('1990-01-01'),
        ocupacion: 'Developer',
        ingresos_mensuales: 50000,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(expectedCliente);

      const result = await service.findOne(clienteId);

      expect(mockPrismaService.financiera_clientes.findUnique).toHaveBeenCalledWith({
        where: { id: clienteId },
        include: {
          persona: true,
          solicitudes: true,
        },
      });
      expect(result).toEqual(expectedCliente);
    });
  });
});
