export type InventoryPermissionLevel = 'read' | 'write';

const NORMALIZED_WRITE_ROLES = ['administrador', 'supervisor', 'almacenero'];
const NORMALIZED_READ_ROLES = [...NORMALIZED_WRITE_ROLES, 'analista'];

const normalizeRole = (role: string | null | undefined) => role?.trim().toLowerCase() ?? '';

export const hasInventoryPermission = (role: string | null | undefined, level: InventoryPermissionLevel) => {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  if (level === 'write') {
    return NORMALIZED_WRITE_ROLES.includes(normalized);
  }

  return NORMALIZED_READ_ROLES.includes(normalized);
};

export const getInventoryGuardMessage = (level: InventoryPermissionLevel) => (
  level === 'write'
    ? 'No cuentas con permisos para modificar el inventario.'
    : 'No cuentas con permisos para visualizar el inventario.'
);
