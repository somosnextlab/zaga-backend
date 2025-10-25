import { Test, TestingModule } from '@nestjs/testing';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueryClientesDto } from './dto/query-clientes.dto';

describe('ClientesService', () => {
  let service: ClientesService;
  // let prismaService: PrismaService;
  // let supabaseService: SupabaseService;

  const mockPrismaService = {
    cliente: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
    },
  };

  const mockSupabaseService = {
    createClientForUser: jest.fn(),
    getUserFromToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
    // prismaService = module.get<PrismaService>(PrismaService);
    // supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated clients for admin', async () => {
      const userId = 'admin-user-id';
      const userRole = 'admin';
      const query: QueryClientesDto = { page: 1, limit: 10 };
      const accessToken = 'test-token';
      const mockClientes = [
        {
          id: 'cliente-1',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
          persona: {
            id: 'persona-1',
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@test.com',
            telefono: '+54911234567',
            tipo_doc: 'DNI',
            numero_doc: '12345678',
          },
        },
      ];
      const total = 1;

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.cliente.findMany.mockResolvedValue(mockClientes);
      mockPrismaService.cliente.count.mockResolvedValue(total);

      const result = await service.findAll(
        userId,
        userRole,
        query,
        accessToken,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockClientes);
      expect(result.meta.total).toBe(1);
      // expect(mockSupabaseService.createClientForUser).toHaveBeenCalledWith(
      //   accessToken,
      // );
    });

    it('should filter by user for non-admin', async () => {
      const userId = 'user-id';
      const userRole = 'usuario';
      const query: QueryClientesDto = { page: 1, limit: 10 };
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      await service.findAll(userId, userRole, query, accessToken);

      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith({
        where: {
          persona: {
            usuario: {
              user_id: userId,
            },
          },
        },
        include: {
          persona: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
              tipo_doc: true,
              numero_doc: true,
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should apply estado filter', async () => {
      const userId = 'admin-user-id';
      const userRole = 'admin';
      const query: QueryClientesDto = {
        page: 1,
        limit: 10,
        estado: 'activo' as any,
      };
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.cliente.findMany.mockResolvedValue([]);
      mockPrismaService.cliente.count.mockResolvedValue(0);

      await service.findAll(userId, userRole, query, accessToken);

      expect(mockPrismaService.cliente.findMany).toHaveBeenCalledWith({
        where: { estado: 'activo' },
        include: expect.any(Object),
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return client for admin', async () => {
      const clienteId = 'cliente-1';
      const userId = 'admin-user-id';
      const userRole = 'admin';
      const accessToken = 'test-token';
      const mockCliente = {
        id: clienteId,
        estado: 'activo',
        persona: {
          id: 'persona-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@test.com',
          telefono: '+54911234567',
          tipo_doc: 'DNI',
          numero_doc: '12345678',
        },
      };

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.cliente.findFirst.mockResolvedValue(mockCliente);

      const result = await service.findOne(
        clienteId,
        userId,
        userRole,
        accessToken,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCliente);
    });

    it('should return error when client not found', async () => {
      const clienteId = 'non-existent-cliente';
      const userId = 'user-id';
      const userRole = 'usuario';
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.cliente.findFirst.mockResolvedValue(null);

      const result = await service.findOne(
        clienteId,
        userId,
        userRole,
        accessToken,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Cliente no encontrado o sin permisos para acceder',
      );
    });
  });

  describe('validateUserAccess', () => {
    it('should return true for valid admin user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'admin', estado: 'activo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateUserAccess(accessToken);

      expect(result.isValid).toBe(true);
      expect(result.role).toBe('admin');
    });

    it('should return true for valid usuario user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'usuario', estado: 'activo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateUserAccess(accessToken);

      expect(result.isValid).toBe(true);
      expect(result.role).toBe('usuario');
    });

    it('should return false for cliente user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'cliente', estado: 'activo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateUserAccess(accessToken);

      expect(result.isValid).toBe(false);
      expect(result.role).toBe('cliente');
    });

    it('should return false for inactive user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'admin', estado: 'inactivo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateUserAccess(accessToken);

      expect(result.isValid).toBe(false);
    });
  });
});
