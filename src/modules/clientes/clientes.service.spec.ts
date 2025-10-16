import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/prisma.service';

import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  let service: ClientesService;

  // Mock del PrismaService
  const mockPrismaService = {
    financiera_clientes: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ClientesService>(ClientesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('debería retornar todos los clientes con paginación', async () => {
      // Arrange
      const mockClientes = [
        {
          id: 'cliente-1',
          persona_id: 'persona-1',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
          persona: {
            id: 'persona-1',
            nombre: 'Juan',
            apellido: 'Pérez',
            email: 'juan@example.com',
            telefono: '+54911234567',
          },
        },
        {
          id: 'cliente-2',
          persona_id: 'persona-2',
          estado: 'activo',
          created_at: new Date(),
          updated_at: new Date(),
          persona: {
            id: 'persona-2',
            nombre: 'María',
            apellido: 'González',
            email: 'maria@example.com',
            telefono: '+54911234568',
          },
        },
      ];

      mockPrismaService.financiera_clientes.findMany.mockResolvedValue(
        mockClientes,
      );
      mockPrismaService.financiera_clientes.count.mockResolvedValue(2);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result).toEqual({
        data: mockClientes,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
      expect(mockPrismaService.financiera_clientes.findMany).toHaveBeenCalledWith(
        {
          skip: 0,
          take: 10,
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
          orderBy: {
            created_at: 'desc',
          },
        },
      );
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.financiera_clientes.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow('Error al obtener clientes');
    });
  });

  describe('findOne', () => {
    it('debería retornar un cliente por ID', async () => {
      // Arrange
      const clienteId = 'cliente-123';
      const mockCliente = {
        id: clienteId,
        persona_id: 'persona-123',
        estado: 'activo',
        created_at: new Date(),
        updated_at: new Date(),
        persona: {
          id: 'persona-123',
          nombre: 'Juan',
          apellido: 'Pérez',
          email: 'juan@example.com',
          telefono: '+54911234567',
          fecha_nac: new Date('1990-01-01'),
        },
      };

      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(
        mockCliente,
      );

      // Act
      const result = await service.findOne(clienteId);

      // Assert
      expect(result).toEqual(mockCliente);
      expect(mockPrismaService.financiera_clientes.findUnique).toHaveBeenCalledWith(
        {
          where: { id: clienteId },
          include: {
            persona: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
                fecha_nac: true,
              },
            },
          },
        },
      );
    });

    it('debería retornar error cuando el cliente no existe', async () => {
      // Arrange
      const clienteId = 'cliente-no-existe';
      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(clienteId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(clienteId)).rejects.toThrow(
        'Cliente no encontrado',
      );
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const clienteId = 'cliente-123';
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.financiera_clientes.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findOne(clienteId)).rejects.toThrow(
        'Error al obtener cliente',
      );
    });
  });

  describe('deactivateClient', () => {
    it('debería desactivar un cliente exitosamente', async () => {
      // Arrange
      const clienteId = 'cliente-123';
      const mockCliente = {
        id: clienteId,
        persona_id: 'persona-123',
        estado: 'activo',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(
        mockCliente,
      );
      mockPrismaService.financiera_clientes.update.mockResolvedValue({});

      // Act
      const result = await service.deactivateClient(clienteId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Cliente desactivado exitosamente',
      });
      expect(mockPrismaService.financiera_clientes.findUnique).toHaveBeenCalledWith(
        { where: { id: clienteId } },
      );
      expect(mockPrismaService.financiera_clientes.update).toHaveBeenCalledWith({
        where: { id: clienteId },
        data: {
          estado: 'inactivo',
          updated_at: expect.any(Date),
        },
      });
    });

    it('debería retornar error cuando el cliente no existe', async () => {
      // Arrange
      const clienteId = 'cliente-no-existe';
      mockPrismaService.financiera_clientes.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deactivateClient(clienteId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deactivateClient(clienteId)).rejects.toThrow(
        'Cliente no encontrado',
      );
    });

    it('debería manejar errores de base de datos', async () => {
      // Arrange
      const clienteId = 'cliente-123';
      const error = new Error('Error de conexión a la base de datos');
      mockPrismaService.financiera_clientes.findUnique.mockRejectedValue(error);

      // Act & Assert
      await expect(service.deactivateClient(clienteId)).rejects.toThrow(
        'Error al desactivar cliente',
      );
    });
  });
});
