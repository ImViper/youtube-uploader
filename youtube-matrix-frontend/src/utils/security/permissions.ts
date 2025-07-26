/**
 * Permission and access control utilities
 */

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

// Import the actual User type from types
import type { User as AppUser } from '@/types';

export interface User extends AppUser {
  permissions?: Permission[];
}

/**
 * Check if user has specific permission
 */
export const hasPermission = (
  user: User,
  resource: string,
  action: string,
  roles?: Role[],
): boolean => {
  // Check direct user permissions
  if (user.permissions) {
    const hasDirectPermission = user.permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
    if (hasDirectPermission) return true;
  }

  // Check role-based permissions
  if (roles && user.role) {
    const role = roles.find((r) => r.id === user.role);
    if (!role) return false;

    return role.permissions.some((p) => p.resource === resource && p.action === action);
  }

  return false;
};

/**
 * Check multiple permissions (all must be true)
 */
export const hasAllPermissions = (
  user: User,
  permissions: Array<{ resource: string; action: string }>,
  roles?: Role[],
): boolean => {
  return permissions.every(({ resource, action }) => hasPermission(user, resource, action, roles));
};

/**
 * Check multiple permissions (at least one must be true)
 */
export const hasAnyPermission = (
  user: User,
  permissions: Array<{ resource: string; action: string }>,
  roles?: Role[],
): boolean => {
  return permissions.some(({ resource, action }) => hasPermission(user, resource, action, roles));
};

/**
 * Resource-based access control
 */
export const canAccessResource = (
  user: User,
  resourceOwnerId: string,
  permission: Permission,
): boolean => {
  // Owner always has access
  if (user.id === resourceOwnerId) return true;

  // Check conditions
  if (permission.conditions) {
    if (permission.conditions.ownerOnly && user.id !== resourceOwnerId) {
      return false;
    }

    if (permission.conditions.requireRole) {
      const hasRequiredRole = user.role === permission.conditions.requireRole;
      if (!hasRequiredRole) return false;
    }
  }

  return true;
};

/**
 * Get filtered data based on permissions
 */
export const filterByPermissions = <T extends { ownerId?: string }>(
  user: User,
  data: T[],
  resource: string,
  action: string,
  roles?: Role[],
): T[] => {
  const hasGeneralPermission = hasPermission(user, resource, action, roles);

  if (hasGeneralPermission) {
    return data;
  }

  // Filter to only owned resources
  return data.filter((item) => item.ownerId === user.id);
};

/**
 * Permission constants
 */
export const PERMISSIONS = {
  // Account permissions
  ACCOUNT_VIEW: { resource: 'account', action: 'view' },
  ACCOUNT_CREATE: { resource: 'account', action: 'create' },
  ACCOUNT_EDIT: { resource: 'account', action: 'edit' },
  ACCOUNT_DELETE: { resource: 'account', action: 'delete' },

  // Upload permissions
  UPLOAD_VIEW: { resource: 'upload', action: 'view' },
  UPLOAD_CREATE: { resource: 'upload', action: 'create' },
  UPLOAD_EDIT: { resource: 'upload', action: 'edit' },
  UPLOAD_DELETE: { resource: 'upload', action: 'delete' },

  // Settings permissions
  SETTINGS_VIEW: { resource: 'settings', action: 'view' },
  SETTINGS_EDIT: { resource: 'settings', action: 'edit' },

  // Monitoring permissions
  MONITORING_VIEW: { resource: 'monitoring', action: 'view' },
  MONITORING_EXPORT: { resource: 'monitoring', action: 'export' },

  // Admin permissions
  ADMIN_USERS: { resource: 'admin', action: 'manage_users' },
  ADMIN_SYSTEM: { resource: 'admin', action: 'manage_system' },
} as const;

/**
 * Default roles
 */
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    permissions: Object.values(PERMISSIONS),
  },
  {
    id: 'user',
    name: 'User',
    permissions: [
      PERMISSIONS.ACCOUNT_VIEW,
      PERMISSIONS.ACCOUNT_CREATE,
      PERMISSIONS.ACCOUNT_EDIT,
      PERMISSIONS.UPLOAD_VIEW,
      PERMISSIONS.UPLOAD_CREATE,
      PERMISSIONS.UPLOAD_EDIT,
      PERMISSIONS.MONITORING_VIEW,
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    permissions: [PERMISSIONS.ACCOUNT_VIEW, PERMISSIONS.UPLOAD_VIEW, PERMISSIONS.MONITORING_VIEW],
  },
];
