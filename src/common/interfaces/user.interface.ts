/**
 * Interfaz para la información del usuario extraída del JWT
 */
export interface UserFromJWT {
  sub: string; // ID del usuario en Supabase
  email: string; // Email del usuario
  role: string; // Rol del usuario (admin/usuario/cliente)
  aud: string; // Audience del JWT
  exp: number; // Timestamp de expiración
  iat: number; // Timestamp de emisión
  accessToken: string; // Token JWT original
}

/**
 * Interfaz para la respuesta estándar de la API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Interfaz para metadatos de paginación
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Interfaz para respuestas paginadas
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}
