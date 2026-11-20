export interface JwtPayload {
  sub: number;          // usuario.id
  empresa_id: number;   // empresa.id
  role: string;         // ex: 'Administrador Master', 'Funcionário'
  type: 'company' | 'user'; // 'company' para token de empresa, 'user' para token de usuário
  permissions: string[]; // ex: ['tasks.create', 'reports.view']
  iat?: number; // issed de token
  exp?: number; // expiração do token
}

