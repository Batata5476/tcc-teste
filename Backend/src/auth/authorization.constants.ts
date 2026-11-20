export const ROLES = {
  MASTER_ADMIN: 'Administrador Master',
  ADMIN: 'Administrador',
  EMPLOYEE: 'Funcionário',
} as const;

export const ADMIN_ROLES: readonly string[] = [
  ROLES.MASTER_ADMIN,
  ROLES.ADMIN,
];

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.includes(role ?? '');
}

// Função para verificar se o papel do usuário é de funcionário 
export function isEmployeeRole(role?: string): boolean {
  const normalizedRole = role
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return normalizedRole === 'funcionario' || normalizedRole === 'employee';
}