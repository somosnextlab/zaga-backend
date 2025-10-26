import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: {
    usuario: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrismaService = {
      usuario: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyProfile', () => {
    it('should return user profile when usuario exists with persona', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const mockUsuario = {
        user_id: userId,
        rol: 'admin',
        estado: 'activo',
        persona: {
          id: 'cdfb5711-d60d-4501-8b54-4c9411bd1e4b',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@test.com',
          telefono: '+54911234567',
        },
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.getMyProfile(userId, accessToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        userId: userId,
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
      expect(mockPrismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: {
          user_id: userId,
        },
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

    it('should return error when usuario not found', async () => {
      const userId = 'non-existent-user';
      const accessToken = 'test-token';

      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      const result = await service.getMyProfile(userId, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Usuario no encontrado. Debe registrarse primero.',
      );
    });

    it('should return error when usuario exists but has no persona', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';
      const mockUsuario = {
        user_id: userId,
        rol: 'admin',
        estado: 'activo',
        persona: null,
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(mockUsuario);

      const result = await service.getMyProfile(userId, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Usuario sin datos de persona asociados.');
    });

    it('should handle database errors', async () => {
      const userId = 'test-user-id';
      const accessToken = 'test-token';

      mockPrismaService.usuario.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getMyProfile(userId, accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error interno del servidor: Database error');
    });
  });
});
