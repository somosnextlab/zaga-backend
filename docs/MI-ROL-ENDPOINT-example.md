# Ejemplo de Integración en el Frontend

## Reemplazo de consulta directa a Supabase

### Antes (consulta directa a Supabase)

```typescript
// ❌ NO RECOMENDADO - Consulta directa a Supabase
import { supabaseServer } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const { data: userData, error: dbError } = await supabase
      .from('seguridad.usuarios')
      .select('rol')
      .eq('user_id', user.id)
      .single();

    if (dbError) {
      console.error('Error consultando rol de usuario:', dbError);
      return NextResponse.json(
        { error: 'Error al obtener rol del usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: userData.rol,
    });
  } catch (error) {
    console.error('Error en user-role API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### Después (usando el endpoint del backend)

```typescript
// ✅ RECOMENDADO - Usando el endpoint del backend
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    // Obtener el token de autorización del header
    const authHeader = _request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    // Llamar al endpoint del backend
    const response = await fetch(`${process.env.BACKEND_URL}/usuarios/mi-rol`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Error al obtener rol del usuario' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en user-role API:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

## Hook personalizado para React

```typescript
// hooks/useUserRole.ts
import { useState, useEffect } from 'react';

interface UserRoleResponse {
  success: boolean;
  role: 'admin' | 'cliente' | 'usuario';
}

export const useUserRole = () => {
  const [role, setRole] = useState<'admin' | 'cliente' | 'usuario' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/usuarios/mi-rol', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Error al obtener rol del usuario');
        }

        const data: UserRoleResponse = await response.json();
        setRole(data.role);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return { role, loading, error };
};
```

## Uso en componentes

```typescript
// components/UserDashboard.tsx
import { useUserRole } from '@/hooks/useUserRole';

export const UserDashboard = () => {
  const { role, loading, error } = useUserRole();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!role) {
    return <div>No se pudo obtener el rol del usuario</div>;
  }

  return (
    <div>
      <h1>Dashboard del Usuario</h1>
      <p>Tu rol es: <strong>{role}</strong></p>
      
      {role === 'admin' && (
        <div>Panel de administración</div>
      )}
      
      {role === 'cliente' && (
        <div>Panel de cliente</div>
      )}
      
      {role === 'usuario' && (
        <div>Completa tu perfil para acceder a más funciones</div>
      )}
    </div>
  );
};
```

## Configuración de variables de entorno

```env
# .env.local
BACKEND_URL=http://localhost:3001
# o en producción:
# BACKEND_URL=https://tu-backend.com
```

## Ventajas de esta implementación

1. **Separación de responsabilidades**: El frontend solo se encarga de la UI, el backend maneja la lógica de negocio
2. **Consistencia**: Usa la misma autenticación y autorización que el resto de la aplicación
3. **Mantenibilidad**: Cambios en la lógica de roles solo requieren actualizar el backend
4. **Seguridad**: El backend puede implementar validaciones adicionales
5. **Logging**: Todas las consultas quedan registradas en los logs del backend
6. **Escalabilidad**: Posibilidad de implementar cache o rate limiting en el backend
