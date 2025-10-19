import { RolesGuard } from '@config/roles.guard';
import { SupabaseJwtGuard } from '@config/supabase-jwt.guard';
import { Test, TestingModule } from '@nestjs/testing';

import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  let service: UsuariosService;

  // Mock del servicio
  const mockUsuariosService = {
    findAll: jest.fn(),
    obtenerRolUsuario: jest.fn(),
    crearPerfil: jest.fn(),
    updateMe: jest.fn(),
    deactivateUser: jest.fn(),
    cambiarEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        {
          provide: UsuariosService,
          useValue: mockUsuariosService,
        },
      ],
    })
      .overrideGuard(SupabaseJwtGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsuariosController>(UsuariosController);
    service = module.get<UsuariosService>(UsuariosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todos los usuarios con paginación', async () => {
      // Arrange
      const mockUsuarios = [
        {
          user_id: 'user-1',
          persona_id: 'persona-1',
          rol: 'admin',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          user_id: 'user-2',
          persona_id: 'persona-2',
          rol: 'cliente',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const expectedResponse = {
        data: mockUsuarios,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      mockUsuariosService.findAll.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.findAll(1, 10);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('debería manejar errores al obtener usuarios', async () => {
      // Arrange
      const error = new Error('Error de base de datos');
      mockUsuariosService.findAll.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findAll()).rejects.toThrow(
        'Error de base de datos',
      );
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('obtenerRolUsuario', () => {
    it('debería retornar el rol del usuario autenticado', async () => {
      // Arrange
      const expectedResponse = {
        success: true,
        role: 'cliente',
      };

      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.obtenerRolUsuario.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.obtenerRolUsuario(mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.obtenerRolUsuario).toHaveBeenCalledWith('user-123');
      expect(service.obtenerRolUsuario).toHaveBeenCalledTimes(1);
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      // Arrange
      const expectedResponse = {
        success: false,
        message: 'Usuario no encontrado en la base de datos',
      };

      const mockRequest = {
        user: {
          user_id: 'user-no-existe',
        },
      };

      mockUsuariosService.obtenerRolUsuario.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.obtenerRolUsuario(mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.obtenerRolUsuario).toHaveBeenCalledWith('user-no-existe');
    });

    it('debería manejar errores al obtener rol del usuario', async () => {
      // Arrange
      const error = new Error('Error de base de datos');
      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.obtenerRolUsuario.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.obtenerRolUsuario(mockRequest)).rejects.toThrow(
        'Error de base de datos',
      );
      expect(service.obtenerRolUsuario).toHaveBeenCalledWith('user-123');
    });
  });

  describe('crearPerfil - Flujo de Negocio Seguro', () => {
    it('debería crear perfil y enviar email de verificación', async () => {
      // Arrange - Flujo de negocio: Crear perfil → Enviar email → NO crear cliente
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
        telefono: '+54911234567',
        fecha_nac: '1990-01-01',
      };

      const expectedResponse = {
        success: true,
        message: 'Perfil creado exitosamente. Ya puedes usar la plataforma.',
        data: {
          persona_id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      };

      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.crearPerfil.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.crearPerfil(createPerfilDto, mockRequest);

      // Assert - Validar nuevo flujo
      expect(result).toEqual(expectedResponse);
      expect(service.crearPerfil).toHaveBeenCalledWith(
        createPerfilDto,
        'user-123',
      );
    });

    it('debería retornar error cuando el usuario ya tiene perfil', async () => {
      // Arrange
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const expectedResponse = {
        success: false,
        message: 'El usuario ya tiene un perfil creado',
      };

      const mockRequest = {
        user: {
          user_id: 'user-con-perfil',
        },
      };

      mockUsuariosService.crearPerfil.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.crearPerfil(createPerfilDto, mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.crearPerfil).toHaveBeenCalledWith(
        createPerfilDto,
        'user-con-perfil',
      );
    });

    it('debería manejar errores al crear perfil', async () => {
      // Arrange
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const error = new Error('Error de base de datos');
      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.crearPerfil.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.crearPerfil(createPerfilDto, mockRequest),
      ).rejects.toThrow('Error de base de datos');
      expect(service.crearPerfil).toHaveBeenCalledWith(
        createPerfilDto,
        'user-123',
      );
    });
  });
});
