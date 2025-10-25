import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';

describe('UsuariosService', () => {
  let service: UsuariosService;
  // let prismaService: PrismaService;
  // let supabaseService: SupabaseService;

  const mockPrismaService = {
    usuario: {
      findMany: jest.fn(),
      count: jest.fn(),
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
        UsuariosService,
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

    service = module.get<UsuariosService>(UsuariosService);
    // prismaService = module.get<PrismaService>(PrismaService);
    // supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated users successfully', async () => {
      const query: QueryUsuariosDto = { page: 1, limit: 10 };
      const accessToken = 'test-token';
      const mockUsuarios = [
        {
          user_id: 'user-1',
          rol: 'admin',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
          persona: {
            id: 'persona-1',
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@test.com',
            telefono: '+54911234567',
          },
        },
      ];
      const total = 1;

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findMany.mockResolvedValue(mockUsuarios);
      mockPrismaService.usuario.count.mockResolvedValue(total);

      const result = await service.findAll(query, accessToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUsuarios);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      // expect(mockSupabaseService.createClientForUser).toHaveBeenCalledWith(
      //   accessToken,
      // );
    });

    it('should apply filters correctly', async () => {
      const query: QueryUsuariosDto = {
        page: 1,
        limit: 10,
        rol: 'admin' as any,
        estado: 'activo' as any,
      };
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findMany.mockResolvedValue([]);
      mockPrismaService.usuario.count.mockResolvedValue(0);

      await service.findAll(query, accessToken);

      expect(mockPrismaService.usuario.findMany).toHaveBeenCalledWith({
        where: { rol: 'admin', estado: 'activo' },
        include: {
          persona: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('should handle database errors', async () => {
      const query: QueryUsuariosDto = { page: 1, limit: 10 };
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll(query, accessToken)).rejects.toThrow(
        'Error interno del servidor al obtener usuarios',
      );
    });
  });

  describe('findOne', () => {
    it('should return user successfully', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const mockUsuario = {
        user_id: userId,
        rol: 'admin',
        estado: 'activo',
        persona: {
          id: 'persona-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@test.com',
          telefono: '+54911234567',
        },
      };

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.findOne(userId, accessToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUsuario);
    });

    it('should return error when user not found', async () => {
      const userId = 'non-existent-user';
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.findOne(userId, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Usuario no encontrado');
    });
  });

  describe('validateAdminAccess', () => {
    it('should return true for admin user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'admin', estado: 'activo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateAdminAccess(accessToken);

      expect(result).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'usuario', estado: 'activo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateAdminAccess(accessToken);

      expect(result).toBe(false);
    });

    it('should return false for inactive user', async () => {
      const accessToken = 'test-token';
      const mockUser = { id: 'user-id' };
      const mockUsuario = { rol: 'admin', estado: 'inactivo' };

      mockSupabaseService.getUserFromToken.mockResolvedValue(mockUser);
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.validateAdminAccess(accessToken);

      expect(result).toBe(false);
    });
  });
});
