-- Seed de bancos y PSPs argentinos más comunes para `ref_bancos`.
-- Idempotente: ON CONFLICT (codigo_entidad) DO NOTHING.
INSERT INTO ref_bancos (codigo_entidad, nombre, tipo) VALUES
  ('007', 'Banco de la Nación Argentina', 'BANCO'),
  ('011', 'Banco de la Provincia de Buenos Aires', 'BANCO'),
  ('034', 'Banco Santander', 'BANCO'),
  ('072', 'Banco HSBC', 'BANCO'),
  ('017', 'BBVA Argentina', 'BANCO'),
  ('027', 'Banco Itaú', 'BANCO'),
  ('029', 'Banco Galicia', 'BANCO'),
  ('044', 'Banco Macro', 'BANCO'),
  ('015', 'ICBC', 'BANCO'),
  ('065', 'Banco Ciudad', 'BANCO'),
  ('191', 'Banco Credicoop', 'BANCO'),
  ('150', 'Banco Nación - Provincia de Córdoba', 'BANCO'),
  ('386', 'Naranja X', 'PSP'),
  ('388', 'Mercado Pago', 'PSP'),
  ('384', 'Ualá', 'PSP'),
  ('389', 'Brubank', 'PSP'),
  ('390', 'Personal Pay', 'PSP'),
  ('391', 'Lemon', 'PSP'),
  ('392', 'Modo', 'PSP'),
  ('393', 'Bimo', 'PSP')
ON CONFLICT (codigo_entidad) DO NOTHING;
