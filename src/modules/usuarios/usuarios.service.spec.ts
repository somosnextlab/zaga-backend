import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/prisma.service';

import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;

  // Mock del PrismaService
  const mockPrismaService = {
    seguridad_usuarios: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    financiera_personas: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    financiera_clientes: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
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

      mockPrismaService.seguridad_usuarios.findMany.mockResolvedValue(
        mockUsuarios,
      );
      mockPrismaService.seguridad_usuarios.count.mockResolvedValue(2);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result).toEqual({
        data: mockUsuarios,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
      expect(
        mockPrismaService.seguridad_usuarios.findMany,
      ).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.seguridad_usuarios.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow(
        'Error al obtener usuarios',
      );
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

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );
      mockPrismaService.financiera_personas.findUnique.mockResolvedValue(
        mockPersona,
      );

      // Act
      const result = await service.findMe(userId);

      // Assert
      expect(result).toEqual({
        ...mockUsuario,
        persona: mockPersona,
      });
      expect(
        mockPrismaService.seguridad_usuarios.findUnique,
      ).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(
        mockPrismaService.financiera_personas.findUnique,
      ).toHaveBeenCalledWith({
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

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );

      // Act
      const result = await service.findMe(userId);

      // Assert
      expect(result).toEqual({
        ...mockUsuario,
        persona: null,
      });
      expect(
        mockPrismaService.seguridad_usuarios.findUnique,
      ).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(
        mockPrismaService.financiera_personas.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      // Arrange
      const userId = 'user-no-existe';
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findMe(userId)).rejects.toThrow(
        'Error al obtener perfil del usuario',
      );
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.seguridad_usuarios.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findMe(userId)).rejects.toThrow(
        'Error al obtener perfil del usuario',
      );
    });
  });

  describe('crearPerfil - Flujo con Supabase Auth', () => {
    it('debería crear perfil y cliente inmediatamente (confiando en Supabase)', async () => {
      // Arrange - Nuevo flujo: Supabase ya verificó email → Crear perfil + cliente
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
        rol: 'usuario',
        estado: 'activo',
      };

      const mockPersona = {
        id: 'persona-123',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const mockCliente = {
        id: 'cliente-123',
        persona_id: 'persona-123',
        estado: 'activo',
      };

      // Configurar mocks
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(null); // No existe persona con mismo DNI
      mockPrismaService.financiera_personas.findFirst.mockResolvedValueOnce(
        null,
      ); // No existe persona con mismo email
      mockPrismaService.financiera_personas.create.mockResolvedValue(
        mockPersona,
      );
      mockPrismaService.seguridad_usuarios.update.mockResolvedValue({});
      mockPrismaService.financiera_clientes.create.mockResolvedValue(
        mockCliente,
      );

      // Act
      const result = await service.crearPerfil(createPerfilDto, userId);

      // Assert - Validar nuevo flujo
      expect(result).toEqual({
        success: true,
        message: 'Perfil creado exitosamente. Ya puedes usar la plataforma.',
        data: {
          persona_id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      });

      // Validar que se creó persona
      expect(mockPrismaService.financiera_personas.create).toHaveBeenCalledWith(
        {
          data: {
            tipo_doc: 'DNI',
            numero_doc: '12345678',
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@example.com',
            telefono: '+54911234567',
            fecha_nac: new Date('1990-01-01'),
          },
        },
      );

      // ✅ NUEVO FLUJO: Cliente se crea inmediatamente
      expect(mockPrismaService.financiera_clientes.create).toHaveBeenCalledWith(
        {
          data: {
            persona_id: 'persona-123',
            estado: 'activo',
          },
        },
      );

      // Supabase ya manejó la verificación de email
    });

    it('debería validar que DNI sea único', async () => {
      // Arrange - Validación de negocio: DNI único
      const userId = 'user-123';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const mockUsuario = {
        user_id: userId,
        persona_id: null,
        rol: 'usuario',
        estado: 'activo',
      };

      const personaExistente = {
        id: 'persona-existente',
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Otro',
        apellido: 'Usuario',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(
        personaExistente,
      );

      // Act & Assert - Debe fallar por DNI duplicado
      await expect(
        service.crearPerfil(createPerfilDto, userId),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.crearPerfil(createPerfilDto, userId),
      ).rejects.toThrow('Ya existe una persona con DNI número 12345678');
    });

    it('debería validar que email sea único', async () => {
      // Arrange - Validación de negocio: Email único
      const userId = 'user-123';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '11111111', // DNI único
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const mockUsuario = {
        user_id: userId,
        persona_id: null,
        rol: 'usuario',
        estado: 'activo',
      };

      const emailExistente = {
        id: 'persona-existente',
        email: 'juan@example.com',
        nombre: 'Otro',
        apellido: 'Usuario',
      };

      // Configurar mocks para que la primera llamada (DNI) devuelva null y la segunda (email) devuelva el email existente
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );
      mockPrismaService.financiera_personas.findFirst
        .mockResolvedValueOnce(null) // No existe DNI
        .mockResolvedValueOnce(emailExistente); // Existe email

      // Act & Assert - Debe fallar por email duplicado
      await expect(
        service.crearPerfil(createPerfilDto, userId),
      ).rejects.toThrow(ConflictException);
    });

    it('debería retornar error cuando el usuario ya tiene perfil', async () => {
      // Arrange - Validación de negocio: Un perfil por usuario
      const userId = 'user-con-perfil';
      const createPerfilDto: CreatePerfilDto = {
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-existente',
        rol: 'cliente',
        estado: 'activo',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(
        mockUsuario,
      );

      // Act & Assert - Debe lanzar excepción
      await expect(
        service.crearPerfil(createPerfilDto, userId),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.crearPerfil(createPerfilDto, userId),
      ).rejects.toThrow('El usuario ya tiene un perfil completo creado');
      expect(
        mockPrismaService.financiera_personas.create,
      ).not.toHaveBeenCalled();
    });
  });
});
