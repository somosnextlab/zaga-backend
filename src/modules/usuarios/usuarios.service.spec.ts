import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/prisma.service';
import { EmailService } from '@shared/email.service';

import { CreatePerfilDto } from './dtos/create-perfil.dto';
import { EmailVerificationService } from './services/email-verification.service';
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
    seguridad_tokens_verificacion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  // Mock del EmailVerificationService
  const mockEmailVerificationService = {
    createVerificationToken: jest.fn(),
    verifyToken: jest.fn(),
    markEmailAsVerified: jest.fn(),
    isEmailVerified: jest.fn(),
    getUserEmail: jest.fn(),
  };

  // Mock del EmailService
  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendEmailChangeNotification: jest.fn(),
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
          provide: EmailVerificationService,
          useValue: mockEmailVerificationService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
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

      mockPrismaService.seguridad_usuarios.findMany.mockResolvedValue(mockUsuarios);
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
      expect(mockPrismaService.seguridad_usuarios.findMany).toHaveBeenCalledWith({
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
      await expect(service.findAll()).rejects.toThrow('Error al obtener usuarios');
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
      await expect(service.findMe(userId)).rejects.toThrow('Error al obtener perfil del usuario');
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

  describe('crearPerfil - Flujo de Negocio Seguro', () => {
    it('debería crear perfil SIN cliente cuando email se envía exitosamente', async () => {
      // Arrange - Flujo de negocio: Crear perfil → Enviar email → NO crear cliente
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
        email_verificado: false,
      };

      const mockPersona = {
        id: 'persona-123',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      };

      const mockToken = 'verification-token-123';

      // Configurar mocks
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(null); // No existe persona con mismo DNI
      mockPrismaService.financiera_personas.findFirst.mockResolvedValueOnce(null); // No existe persona con mismo email
      mockPrismaService.financiera_personas.create.mockResolvedValue(mockPersona);
      mockPrismaService.seguridad_usuarios.update.mockResolvedValue({});
      mockEmailVerificationService.createVerificationToken.mockResolvedValue(mockToken);
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      // Act
      const result = await service.crearPerfil(createPerfilDto, userId);

      // Assert - Validar flujo de negocio
      expect(result).toEqual({
        success: true,
        message: 'Perfil creado exitosamente. Se ha enviado un email de verificación. Debes verificar tu email para completar el registro.',
        data: {
          persona_id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
          email_verificado: false,
        },
        token: process.env.NODE_ENV === 'development' ? mockToken : undefined,
      });

      // Validar que se creó persona pero NO cliente
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

      // PRINCIPIO DE SEGURIDAD: NO se debe crear cliente antes de verificar email
      expect(mockPrismaService.financiera_clientes.create).not.toHaveBeenCalled();

      // Validar que se envió email de verificación
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        'juan@example.com',
        mockToken,
      );
    });

    it('debería fallar si el email no se puede enviar', async () => {
      // Arrange - Escenario de error: Email falla
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
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(null);
      mockPrismaService.financiera_personas.create.mockResolvedValue({
        id: 'persona-123',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
      });
      mockPrismaService.seguridad_usuarios.update.mockResolvedValue({});
      mockEmailVerificationService.createVerificationToken.mockResolvedValue('token');
      mockEmailService.sendVerificationEmail.mockRejectedValue(new Error('SendGrid error'));

      // Act & Assert - Debe fallar si no se puede enviar email
      await expect(service.crearPerfil(createPerfilDto, userId)).rejects.toThrow(
        'Error al crear perfil del usuario',
      );
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
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      const personaExistente = {
        id: 'persona-existente',
        tipo_doc: 'DNI',
        numero_doc: '12345678',
        nombre: 'Otro',
        apellido: 'Usuario',
      };

      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(personaExistente);

      // Act & Assert - Debe fallar por DNI duplicado
      await expect(service.crearPerfil(createPerfilDto, userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.crearPerfil(createPerfilDto, userId)).rejects.toThrow(
        'Ya existe una persona con DNI número 12345678',
      );
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
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      const emailExistente = {
        id: 'persona-existente',
        email: 'juan@example.com',
        nombre: 'Otro',
        apellido: 'Usuario',
      };

      // Configurar mocks para que la primera llamada (DNI) devuelva null y la segunda (email) devuelva el email existente
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_personas.findFirst
        .mockResolvedValueOnce(null) // No existe DNI
        .mockResolvedValueOnce(emailExistente); // Existe email

      // Act & Assert - Debe fallar por email duplicado
      await expect(service.crearPerfil(createPerfilDto, userId)).rejects.toThrow(
        ConflictException,
      );
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
        email_verificado: true,
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
  });

  describe('verificarEmail - Flujo de Negocio Seguro', () => {
    it('debería verificar email y crear cliente automáticamente', async () => {
      // Arrange - Flujo de negocio: Verificar email → Crear cliente
      const token = 'valid-token-123';
      const userId = 'user-123';
      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-123',
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      const mockCliente = {
        id: 'cliente-123',
        persona_id: 'persona-123',
        estado: 'activo',
      };

      mockEmailVerificationService.verifyToken.mockResolvedValue(userId);
      mockEmailVerificationService.markEmailAsVerified.mockResolvedValue(undefined);
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_clientes.findFirst.mockResolvedValue(null); // No existe cliente
      mockPrismaService.financiera_clientes.create.mockResolvedValue(mockCliente);

      // Act
      const result = await service.verificarEmail(token);

      // Assert - Validar flujo de negocio completo
      expect(result).toEqual({
        success: true,
        message: 'Email verificado exitosamente. Tu cuenta está ahora completamente activa.',
        data: {
          email_verificado: true,
          cliente_creado: true,
        },
      });

      // Validar que se verificó el email
      expect(mockEmailVerificationService.verifyToken).toHaveBeenCalledWith(
        token,
        'email_verification',
      );
      expect(mockEmailVerificationService.markEmailAsVerified).toHaveBeenCalledWith(userId);

      // PRINCIPIO DE SEGURIDAD: Cliente se crea SOLO después de verificar email
      expect(mockPrismaService.financiera_clientes.create).toHaveBeenCalledWith({
        data: {
          persona_id: 'persona-123',
          estado: 'activo',
        },
      });
    });

    it('debería manejar caso cuando cliente ya existe', async () => {
      // Arrange - Edge case: Cliente ya existe
      const token = 'valid-token-123';
      const userId = 'user-123';
      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-123',
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      const mockClienteExistente = {
        id: 'cliente-existente',
        persona_id: 'persona-123',
        estado: 'activo',
      };

      mockEmailVerificationService.verifyToken.mockResolvedValue(userId);
      mockEmailVerificationService.markEmailAsVerified.mockResolvedValue(undefined);
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);
      mockPrismaService.financiera_clientes.findFirst.mockResolvedValue(mockClienteExistente);

      // Act
      const result = await service.verificarEmail(token);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Email verificado exitosamente. Tu cuenta está ahora completamente activa.',
        data: {
          email_verificado: true,
          cliente_creado: false, // Ya existía
        },
      });

      // No debe crear cliente duplicado
      expect(mockPrismaService.financiera_clientes.create).not.toHaveBeenCalled();
    });

    it('debería fallar con token inválido', async () => {
      // Arrange - Escenario de error: Token inválido
      const token = 'invalid-token';
      const error = new Error('Token inválido o expirado');

      mockEmailVerificationService.verifyToken.mockRejectedValue(error);

      // Act & Assert
      await expect(service.verificarEmail(token)).rejects.toThrow('Error al verificar email');
    });

    it('debería fallar cuando usuario no existe', async () => {
      // Arrange - Escenario de error: Usuario no encontrado
      const token = 'valid-token-123';
      const userId = 'user-inexistente';

      mockEmailVerificationService.verifyToken.mockResolvedValue(userId);
      mockEmailVerificationService.markEmailAsVerified.mockResolvedValue(undefined);
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verificarEmail(token)).rejects.toThrow(NotFoundException);
      await expect(service.verificarEmail(token)).rejects.toThrow('Usuario o perfil no encontrado');
    });

    it('debería fallar cuando usuario no tiene persona_id', async () => {
      // Arrange - Escenario de error: Usuario sin perfil
      const token = 'valid-token-123';
      const userId = 'user-123';
      const mockUsuario = {
        user_id: userId,
        persona_id: null, // Sin perfil
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };

      mockEmailVerificationService.verifyToken.mockResolvedValue(userId);
      mockEmailVerificationService.markEmailAsVerified.mockResolvedValue(undefined);
      mockPrismaService.seguridad_usuarios.findUnique.mockResolvedValue(mockUsuario);

      // Act & Assert
      await expect(service.verificarEmail(token)).rejects.toThrow(NotFoundException);
      await expect(service.verificarEmail(token)).rejects.toThrow('Usuario o perfil no encontrado');
    });
  });

  describe('reenviarVerificacion - Flujo de Negocio', () => {
    it('debería reenviar email de verificación exitosamente', async () => {
      // Arrange
      const email = 'juan@example.com';
      const userId = 'user-123';
      const mockPersona = {
        id: 'persona-123',
        email: email,
        nombre: 'Juan',
        apellido: 'Pérez',
      };
      const mockUsuario = {
        user_id: userId,
        persona_id: 'persona-123',
        rol: 'cliente',
        estado: 'activo',
        email_verificado: false,
      };
      const mockToken = 'new-verification-token';

      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(mockPersona);
      mockPrismaService.seguridad_usuarios.findFirst.mockResolvedValue(mockUsuario);
      mockEmailVerificationService.createVerificationToken.mockResolvedValue(mockToken);
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      // Act
      const result = await service.reenviarVerificacion(email);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Email de verificación reenviado',
        token: process.env.NODE_ENV === 'development' ? mockToken : undefined,
      });

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(email, mockToken);
    });

    it('debería fallar cuando email no existe', async () => {
      // Arrange
      const email = 'noexiste@example.com';
      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.reenviarVerificacion(email)).rejects.toThrow(NotFoundException);
      await expect(service.reenviarVerificacion(email)).rejects.toThrow('Email no encontrado');
    });

    it('debería fallar cuando email ya está verificado', async () => {
      // Arrange
      const email = 'juan@example.com';
      const mockPersona = {
        id: 'persona-123',
        email: email,
      };
      const mockUsuario = {
        user_id: 'user-123',
        persona_id: 'persona-123',
        email_verificado: true, // Ya verificado
      };

      mockPrismaService.financiera_personas.findFirst.mockResolvedValue(mockPersona);
      mockPrismaService.seguridad_usuarios.findFirst.mockResolvedValue(mockUsuario);

      // Act
      const result = await service.reenviarVerificacion(email);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'El email ya está verificado',
      });
    });
  });
});
