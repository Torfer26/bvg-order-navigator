/**
 * Users Service
 * Handles CRUD operations for user management
 * Implements Option B: Auto-registration with role management
 */

import { bvgFetch, API_BASE_URL } from './api';

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'admin' | 'ops' | 'read';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface PlatformUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  department?: string;
  phone?: string;
  authProvider: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  createdBy?: number;
  updatedBy?: number;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  phone?: string;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  phone?: string;
}

export interface UserActivityLog {
  id: number;
  userId?: number;
  userEmail: string;
  action: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// User CRUD Operations
// ============================================================================

/**
 * Fetch all users
 */
export async function fetchUsers(): Promise<PlatformUser[]> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/users?order=name.asc`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    
    const data = await response.json();
    return data.map(mapUserFromApi);
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Fetch a single user by ID
 */
export async function fetchUserById(id: number): Promise<PlatformUser | null> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/users?id=eq.${id}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    
    const data = await response.json();
    return data.length > 0 ? mapUserFromApi(data[0]) : null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Fetch user by email
 */
export async function fetchUserByEmail(email: string): Promise<PlatformUser | null> {
  try {
    const response = await bvgFetch(
      `${API_BASE_URL}/users?email=eq.${encodeURIComponent(email.toLowerCase())}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    
    const data = await response.json();
    return data.length > 0 ? mapUserFromApi(data[0]) : null;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  payload: CreateUserPayload,
  createdBy?: number
): Promise<{ success: boolean; user?: PlatformUser; message: string }> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        name: payload.name,
        role: payload.role || 'read',
        status: payload.status || 'active',
        department: payload.department || null,
        phone: payload.phone || null,
        auth_provider: 'manual',
        created_by: createdBy || null,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return { success: false, message: 'Ya existe un usuario con este email' };
      }
      throw new Error(errorText);
    }
    
    const data = await response.json();
    const user = mapUserFromApi(data[0]);
    
    // Log activity
    await logUserActivity(user.id, user.email, 'created', { created_by: createdBy });
    
    return { success: true, user, message: 'Usuario creado correctamente' };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, message: 'Error al crear el usuario' };
  }
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: number,
  payload: UpdateUserPayload,
  updatedBy?: number
): Promise<{ success: boolean; user?: PlatformUser; message: string }> {
  try {
    // Get current user data for audit
    const currentUser = await fetchUserById(id);
    
    const updateData: Record<string, unknown> = {
      updated_by: updatedBy || null,
    };
    
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.role !== undefined) updateData.role = payload.role;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.department !== undefined) updateData.department = payload.department || null;
    if (payload.phone !== undefined) updateData.phone = payload.phone || null;
    
    const response = await bvgFetch(`${API_BASE_URL}/users?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    
    const data = await response.json();
    const user = mapUserFromApi(data[0]);
    
    // Log activity with changes
    const changes: Record<string, unknown> = {};
    if (currentUser) {
      if (payload.role && payload.role !== currentUser.role) {
        changes.role_from = currentUser.role;
        changes.role_to = payload.role;
      }
      if (payload.status && payload.status !== currentUser.status) {
        changes.status_from = currentUser.status;
        changes.status_to = payload.status;
      }
    }
    
    await logUserActivity(
      user.id, 
      user.email, 
      payload.role !== currentUser?.role ? 'role_changed' : 'updated',
      { ...changes, updated_by: updatedBy }
    );
    
    return { success: true, user, message: 'Usuario actualizado correctamente' };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, message: 'Error al actualizar el usuario' };
  }
}

/**
 * Delete a user (soft delete by setting status to inactive)
 */
export async function deleteUser(
  id: number,
  deletedBy?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await fetchUserById(id);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    
    // Soft delete: set status to inactive
    const response = await bvgFetch(`${API_BASE_URL}/users?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'inactive',
        updated_by: deletedBy || null,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
    
    // Log activity
    await logUserActivity(id, user.email, 'deactivated', { deleted_by: deletedBy });
    
    return { success: true, message: 'Usuario desactivado correctamente' };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, message: 'Error al desactivar el usuario' };
  }
}

/**
 * Reactivate a user
 */
export async function reactivateUser(
  id: number,
  reactivatedBy?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await bvgFetch(`${API_BASE_URL}/users?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'active',
        updated_by: reactivatedBy || null,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to reactivate user');
    }
    
    const user = await fetchUserById(id);
    if (user) {
      await logUserActivity(id, user.email, 'reactivated', { reactivated_by: reactivatedBy });
    }
    
    return { success: true, message: 'Usuario reactivado correctamente' };
  } catch (error) {
    console.error('Error reactivating user:', error);
    return { success: false, message: 'Error al reactivar el usuario' };
  }
}

// ============================================================================
// Auto-registration (Sync with Auth Provider)
// ============================================================================

/**
 * Sync user from authentication provider (auto-registration)
 * Creates user if not exists, updates last_login if exists
 */
export async function syncUserFromAuth(
  email: string,
  name: string,
  authProvider: string = 'cloudflare',
  externalId?: string
): Promise<PlatformUser | null> {
  try {
    // Check if user exists
    let user = await fetchUserByEmail(email);
    
    if (!user) {
      // Check if this is the first user (make them admin)
      const allUsers = await fetchUsers();
      const defaultRole: UserRole = allUsers.length === 0 ? 'admin' : 'read';
      
      // Create new user
      const response = await bvgFetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          name: name,
          role: defaultRole,
          status: 'active',
          auth_provider: authProvider,
          external_id: externalId || null,
          last_login_at: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        // If creation failed due to race condition, try to fetch again
        user = await fetchUserByEmail(email);
        if (user) {
          // Update last login
          await updateLastLogin(user.id);
          return user;
        }
        throw new Error('Failed to create user');
      }
      
      const data = await response.json();
      user = mapUserFromApi(data[0]);
      
      // Log activity
      await logUserActivity(user.id, user.email, 'auto_registered', { 
        auth_provider: authProvider,
        default_role: defaultRole 
      });
      
      console.log(`[UsersService] New user auto-registered: ${email} with role ${defaultRole}`);
    } else {
      // Update last login
      await updateLastLogin(user.id);
      
      // Log login activity
      await logUserActivity(user.id, user.email, 'login', { auth_provider: authProvider });
    }
    
    return user;
  } catch (error) {
    console.error('Error syncing user from auth:', error);
    return null;
  }
}

/**
 * Update user's last login timestamp
 */
async function updateLastLogin(userId: number): Promise<void> {
  try {
    await bvgFetch(`${API_BASE_URL}/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        last_login_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Error updating last login:', error);
  }
}

// ============================================================================
// Activity Logging
// ============================================================================

/**
 * Log user activity for audit trail
 */
export async function logUserActivity(
  userId: number | null,
  userEmail: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await bvgFetch(`${API_BASE_URL}/user_activity_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        user_email: userEmail,
        action: action,
        details: details || null,
      }),
    });
  } catch (error) {
    // Don't throw - logging failures shouldn't break the app
    console.error('Error logging user activity:', error);
  }
}

/**
 * Fetch user activity log
 */
export async function fetchUserActivityLog(
  userId?: number,
  limit: number = 100
): Promise<UserActivityLog[]> {
  try {
    let url = `${API_BASE_URL}/user_activity_log?order=created_at.desc&limit=${limit}`;
    if (userId) {
      url += `&user_id=eq.${userId}`;
    }
    
    const response = await bvgFetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch activity log');
    }
    
    const data = await response.json();
    return data.map((row: Record<string, unknown>) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      action: row.action,
      details: row.details,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }
}

// ============================================================================
// Stats
// ============================================================================

/**
 * Fetch user statistics
 */
export async function fetchUserStats(): Promise<{
  total: number;
  byRole: Record<UserRole, number>;
  byStatus: Record<UserStatus, number>;
  activeLastWeek: number;
  activeLastMonth: number;
}> {
  try {
    const users = await fetchUsers();
    
    const stats = {
      total: users.length,
      byRole: { admin: 0, ops: 0, read: 0 } as Record<UserRole, number>,
      byStatus: { active: 0, inactive: 0, pending: 0 } as Record<UserStatus, number>,
      activeLastWeek: 0,
      activeLastMonth: 0,
    };
    
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    for (const user of users) {
      stats.byRole[user.role]++;
      stats.byStatus[user.status]++;
      
      if (user.lastLoginAt) {
        const lastLogin = new Date(user.lastLoginAt);
        if (lastLogin > weekAgo) stats.activeLastWeek++;
        if (lastLogin > monthAgo) stats.activeLastMonth++;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return {
      total: 0,
      byRole: { admin: 0, ops: 0, read: 0 },
      byStatus: { active: 0, inactive: 0, pending: 0 },
      activeLastWeek: 0,
      activeLastMonth: 0,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map API response to PlatformUser
 */
function mapUserFromApi(row: Record<string, unknown>): PlatformUser {
  return {
    id: row.id as number,
    email: row.email as string,
    name: row.name as string,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    avatarUrl: row.avatar_url as string | undefined,
    department: row.department as string | undefined,
    phone: row.phone as string | undefined,
    authProvider: row.auth_provider as string,
    externalId: row.external_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastLoginAt: row.last_login_at as string | undefined,
    createdBy: row.created_by as number | undefined,
    updatedBy: row.updated_by as number | undefined,
  };
}

/**
 * Role display names
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  ops: 'Operador',
  read: 'Solo lectura',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acceso total: gestión de usuarios, configuración y todas las operaciones',
  ops: 'Operaciones: aprobar pedidos, gestionar datos, sin acceso a configuración',
  read: 'Solo lectura: visualizar información sin poder modificar',
};

/**
 * Status display names
 */
export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  pending: 'Pendiente',
};
