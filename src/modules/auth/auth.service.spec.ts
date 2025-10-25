import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  // let prismaService: PrismaService;
  // let supabaseService: SupabaseService;

  const mockPrismaService = {
    usuario: {
      findUnique: jest.fn(),
    },
  };

  const mockSupabaseService = {
    createClientForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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

    service = module.get<AuthService>(AuthService);
    // prismaService = module.get<PrismaService>(PrismaService);
    // supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('should return user profile successfully', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const mockUsuario = {
        user_id: userId,
        rol: 'admin',
        estado: 'activo',
        persona: {
          id: 'persona-id',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@test.com',
          telefono: '+54911234567',
        },
      };

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.getMyProfile(userId, accessToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        userId: mockUsuario.user_id,
        email: mockUsuario.persona.email,
        role: mockUsuario.rol,
        estado: mockUsuario.estado,
        persona: {
          id: mockUsuario.persona.id,
          nombre: mockUsuario.persona.nombre,
          apellido: mockUsuario.persona.apellido,
          telefono: mockUsuario.persona.telefono,
        },
      });
      // expect(mockSupabaseService.createClientForUser).toHaveBeenCalledWith(
      //   accessToken,
      // );
      expect(mockPrismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { user_id: userId },
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
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'non-existent-user';
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile(userId, accessToken)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle database errors', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';

      mockSupabaseService.createClientForUser.mockReturnValue({});
      mockPrismaService.usuario.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getMyProfile(userId, accessToken)).rejects.toThrow(
        'Error interno del servidor al obtener perfil',
      );
    });
  });

  describe('validateUserRole', () => {
    it('should return true for valid role', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const requiredRole = 'admin';

      jest.spyOn(service, 'getMyProfile').mockResolvedValue({
        success: true,
        data: {
          userId,
          email: 'test@test.com',
          role: 'admin',
          estado: 'activo',
        },
      });

      const result = await service.validateUserRole(
        userId,
        accessToken,
        requiredRole,
      );

      expect(result).toBe(true);
    });

    it('should return false for invalid role', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const requiredRole = 'admin';

      jest.spyOn(service, 'getMyProfile').mockResolvedValue({
        success: true,
        data: {
          userId,
          email: 'test@test.com',
          role: 'usuario',
          estado: 'activo',
        },
      });

      const result = await service.validateUserRole(
        userId,
        accessToken,
        requiredRole,
      );

      expect(result).toBe(false);
    });
  });

  describe('isUserActive', () => {
    it('should return true for active user', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';

      jest.spyOn(service, 'getMyProfile').mockResolvedValue({
        success: true,
        data: {
          userId,
          email: 'test@test.com',
          role: 'admin',
          estado: 'activo',
        },
      });

      const result = await service.isUserActive(userId, accessToken);

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';

      jest.spyOn(service, 'getMyProfile').mockResolvedValue({
        success: true,
        data: {
          userId,
          email: 'test@test.com',
          role: 'admin',
          estado: 'inactivo',
        },
      });

      const result = await service.isUserActive(userId, accessToken);

      expect(result).toBe(false);
    });
  });
});
