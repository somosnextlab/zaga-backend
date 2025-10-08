import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '@shared/prisma.service';
import { CreatePerfilDto } from './dtos/create-perfil.dto';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prismaService: PrismaService;

  // Mock del PrismaService
  const mockPrismaService = {
    seguridad_usuarios: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    financiera_personas: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    financiera_clientes: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todos los usuarios exitosamente', async () => {
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

      mockPrismaService.seguridad_usuarios.findMany.mockResolvedValue(mockUsuarios);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockUsuarios,
        count: 2,
      });
      expect(mockPrismaService.seguridad_usuarios.findMany).toHaveBeenCalledTimes(1);
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.seguridad_usuarios.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow('Error al obtener usuarios');
      expect(mockPrismaService.seguridad_usuarios.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findMe', () => {
    it('debería retornar el perfil del usuario con datos de persona', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-123',
        rol: 'cliente',
        estado: 'activo',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockPersona = {
        id: 'persona-123',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
        telefono: '+54911234567',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.findUnique.mockResolvedValue(mockPersona);

      // Act
      const result = await service.findMe(userId);

      // Assert
      expect(result).toEqual({
        success: true,
        data: {
          ...mockUsuario,
          persona: mockPersona,
        },
      });
      expect(mockPrismaService.seguridad_usuarios.findUnique).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(mockPrismaService.financiera_personas.findUnique).toHaveBeenCalledWith({
        where: { id: 'persona-123' },
      });
    });

    it('debería retornar usuario sin datos de persona cuando no tiene persona_id', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUsuario = {
        user_id: userId,
        persona_id: null,
        rol: 'cliente',
        estado: 'activo',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);

      // Act
      const result = await service.findMe(userId);

      // Assert
      expect(result).toEqual({
        success: true,
        data: {
          ...mockUsuario,
          persona: null,
        },
      });
      expect(mockPrismaService.seguridad_usuarios.findUnique).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(mockPrismaService.financiera_personas.findUnique).not.toHaveBeenCalled();
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      // Arrange
      const userId = 'user-no-existe';
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findMe(userId);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Usuario no encontrado',
      });
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.seguridad_usuarios.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findMe(userId)).rejects.toThrow('Error al obtener perfil del usuario');
    });
  });

  describe('crearPerfil', () => {
    it('debería crear un perfil exitosamente', async () => {
      // Arrange
      const userId = 'user-123';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
        telefono: '+54911234567',
        fecha_nac: '1990-01-01',
      };

      const mockUsuario = {
        user_id: userId,
        persona_id: null,
        rol: 'cliente',
        estado: 'activo',
      };

      const mockPersona = {
        id: 'persona-123',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.create.mockResolvedValue(mockPersona);
      mockPrismaService.seguridad_usuarios.update.mockResolvedValue({});
      mockPrismaService.financiera_clientes.create.mockResolvedValue({});

      // Act
      const result = await service.crearPerfil(createPerfilDto, userId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Perfil creado exitosamente',
        data: {
          persona_id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      });

      expect(mockPrismaService.seguridad_usuarios.findUnique).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(mockPrismaService.financiera_personas.create).toHaveBeenCalledWith({
        data: {
          tipo_doc: 'DNI',
          numero_doc: '12345678',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@example.com',
          telefono: '+54911234567',
          fecha_nac: new Date('1990-01-01'),
        },
      });
      expect(mockPrismaService.seguridad_usuarios.update).toHaveBeenCalledWith({
        where: { user_id: userId },
        data: { persona_id: 'persona-123' },
      });
      expect(mockPrismaService.financiera_clientes.create).toHaveBeenCalledWith({
        data: {
          persona_id: 'persona-123',
          estado: 'activo',
        },
      });
    });

    it('debería retornar error cuando el usuario ya tiene perfil', async () => {
      // Arrange
      const userId = 'user-con-perfil';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-existente',
        rol: 'cliente',
        estado: 'activo',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);

      // Act
      const result = await service.crearPerfil(createPerfilDto, userId);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'El usuario ya tiene un perfil creado',
      });
      expect(mockPrismaService.financiera_personas.create).not.toHaveBeenCalled();
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const userId = 'user-123';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.seguridad_usuarios.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(service.crearPerfil(createPerfilDto, userId)).rejects.toThrow('Error al crear perfil del usuario');
    });
  });
});
