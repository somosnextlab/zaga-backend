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
    findMe: jest.fn(),
    crearPerfil: jest.fn(),
    verificarEmail: jest.fn(),
    reenviarVerificacion: jest.fn(),
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
          email_verificado: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          user_id: 'user-2',
          persona_id: 'persona-2',
          rol: 'cliente',
          estado: 'activo',
          email_verificado: false,
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
      await expect(controller.findAll()).rejects.toThrow('Error de base de datos');
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMe', () => {
    it('debería retornar el perfil del usuario autenticado', async () => {
      // Arrange
      const mockUser = {
        user_id: 'user-123',
        persona_id: 'persona-123',
        rol: 'cliente',
        estado: 'activo',
        created_at: new Date(),
        updated_at: new Date(),
        persona: {
          id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@example.com',
        },
      };

      const expectedResponse = {
        success: true,
        data: mockUser,
      };

      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.findMe.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.findMe(mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.findMe).toHaveBeenCalledWith('user-123');
      expect(service.findMe).toHaveBeenCalledTimes(1);
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      // Arrange
      const expectedResponse = {
        success: false,
        message: 'Usuario no encontrado',
      };

      const mockRequest = {
        user: {
          user_id: 'user-no-existe',
        },
      };

      mockUsuariosService.findMe.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.findMe(mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.findMe).toHaveBeenCalledWith('user-no-existe');
    });

    it('debería manejar errores al obtener perfil del usuario', async () => {
      // Arrange
      const error = new Error('Error de base de datos');
      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.findMe.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.findMe(mockRequest)).rejects.toThrow(
        'Error de base de datos',
      );
      expect(service.findMe).toHaveBeenCalledWith('user-123');
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
        message: 'Perfil creado exitosamente. Se ha enviado un email de verificación. Debes verificar tu email para completar el registro.',
        data: {
          persona_id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
          email_verificado: false,
        },
        token: 'verification-token-123', // En desarrollo
      };

      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.crearPerfil.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.crearPerfil(createPerfilDto, mockRequest);

      // Assert - Validar flujo de negocio
      expect(result).toEqual(expectedResponse);
      expect(service.crearPerfil).toHaveBeenCalledWith(createPerfilDto, 'user-123');
      expect(result.data.email_verificado).toBe(false); // No verificado aún
      expect(result.token).toBeDefined(); // Token para verificación
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
      expect(service.crearPerfil).toHaveBeenCalledWith(createPerfilDto, 'user-con-perfil');
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
      await expect(controller.crearPerfil(createPerfilDto, mockRequest)).rejects.toThrow(
        'Error de base de datos',
      );
      expect(service.crearPerfil).toHaveBeenCalledWith(createPerfilDto, 'user-123');
    });
  });

  describe('verificarEmail - Flujo de Negocio Seguro', () => {
    it('debería verificar email y crear cliente automáticamente', async () => {
      // Arrange - Flujo de negocio: Verificar email → Crear cliente
      const verificarEmailDto = {
        token: 'valid-token-123',
      };

      const expectedResponse = {
        success: true,
        message: 'Email verificado exitosamente. Tu cuenta está ahora completamente activa.',
        data: {
          email_verificado: true,
          cliente_creado: true,
        },
      };

      mockUsuariosService.verificarEmail.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.verificarEmail(verificarEmailDto);

      // Assert - Validar flujo de negocio
      expect(result).toEqual(expectedResponse);
      expect(service.verificarEmail).toHaveBeenCalledWith('valid-token-123');
      expect(result.data.email_verificado).toBe(true);
      expect(result.data.cliente_creado).toBe(true);
    });

    it('debería manejar errores al verificar email', async () => {
      // Arrange
      const verificarEmailDto = {
        token: 'invalid-token',
      };

      const error = new Error('Token inválido o expirado');
      mockUsuariosService.verificarEmail.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.verificarEmail(verificarEmailDto)).rejects.toThrow(
        'Token inválido o expirado',
      );
      expect(service.verificarEmail).toHaveBeenCalledWith('invalid-token');
    });
  });

  describe('reenviarVerificacion - Flujo de Negocio', () => {
    it('debería reenviar email de verificación exitosamente', async () => {
      // Arrange
      const reenviarVerificacionDto = {
        email: 'juan@example.com',
      };

      const expectedResponse = {
        success: true,
        message: 'Email de verificación reenviado',
        token: 'new-verification-token', // En desarrollo
      };

      mockUsuariosService.reenviarVerificacion.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.reenviarVerificacion(reenviarVerificacionDto);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.reenviarVerificacion).toHaveBeenCalledWith('juan@example.com');
    });

    it('debería manejar errores al reenviar verificación', async () => {
      // Arrange
      const reenviarVerificacionDto = {
        email: 'noexiste@example.com',
      };

      const error = new Error('Email no encontrado');
      mockUsuariosService.reenviarVerificacion.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.reenviarVerificacion(reenviarVerificacionDto)).rejects.toThrow(
        'Email no encontrado',
      );
      expect(service.reenviarVerificacion).toHaveBeenCalledWith('noexiste@example.com');
    });
  });
});
