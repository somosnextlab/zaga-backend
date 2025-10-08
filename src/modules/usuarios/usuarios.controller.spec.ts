import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { CreatePerfilDto } from './dtos/create-perfil.dto';

describe('UsuariosController', () => {
  let controller: UsuariosController;
  let service: UsuariosService;

  // Mock del servicio
  const mockUsuariosService = {
    findAll: jest.fn(),
    findMe: jest.fn(),
    crearPerfil: jest.fn(),
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
    .overrideGuard(require('@config/supabase-jwt.guard').SupabaseJwtGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .overrideGuard(require('@config/roles.guard').RolesGuard)
    .useValue({ canActivate: jest.fn().mockReturnValue(true) })
    .compile();

    controller = module.get<UsuariosController>(UsuariosController);
    service = module.get<UsuariosService>(UsuariosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todos los usuarios', async () => {
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
        success: true,
        data: mockUsuarios,
        count: 2,
      };

      mockUsuariosService.findAll.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.findAll).toHaveBeenCalledTimes(1);
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
      await expect(controller.findMe(mockRequest)).rejects.toThrow('Error de base de datos');
      expect(service.findMe).toHaveBeenCalledWith('user-123');
    });
  });

  describe('crearPerfil', () => {
    it('debería crear un perfil exitosamente', async () => {
      // Arrange
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
        message: 'Perfil creado exitosamente',
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

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.crearPerfil).toHaveBeenCalledWith(createPerfilDto, 'user-123');
      expect(service.crearPerfil).toHaveBeenCalledTimes(1);
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
      };

      const error = new Error('Error de base de datos');
      const mockRequest = {
        user: {
          user_id: 'user-123',
        },
      };

      mockUsuariosService.crearPerfil.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.crearPerfil(createPerfilDto, mockRequest)).rejects.toThrow('Error de base de datos');
      expect(service.crearPerfil).toHaveBeenCalledWith(createPerfilDto, 'user-123');
    });
  });
});