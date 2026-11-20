import { SetMetadata } from '@nestjs/common';

// Decorator para definir roles necessárias para acessar um recurso
export const Roles = (...roles: string[]) =>
	SetMetadata('roles', roles);

// Decorator para definir permissõoes necessárias para acessar um recurso
export const Permissions = (...permissions: string[]) =>
	SetMetadata('permissions', permissions);
