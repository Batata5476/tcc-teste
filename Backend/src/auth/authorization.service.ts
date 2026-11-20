import { Injectable } from '@nestjs/common';
import { Permission } from '../users/entities/permission.entity';

@Injectable()
export class AuthorizationService {
  // Método para obter permissões combinadas de usuário e função
    getPermissions(
    rolePermissions: Permission[],
    userPermissions: Permission[],
  ): string[] {
    const allPermissions = [
      ...rolePermissions,
      ...userPermissions,
    ];

    // Remove duplicatas e retorna apenas os nomes das permissões
    return [
      ...new Set(
        allPermissions.map((permission) => permission.nome),
      ),
    ];
  }
}