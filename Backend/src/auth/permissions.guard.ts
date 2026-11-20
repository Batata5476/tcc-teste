import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAdminRole } from './authorization.constants';

const DEFAULT_EMPLOYEE_PERMISSIONS = [
	'dashboard.user.read',
	'users.read',
	'users.update',
	'chat.read',
	'chat.create',
	'chat.delete',
	'meetings.read',
	'meetings.create',
	'meetings.update',
	'occurrences.read',
	'occurrences.create',
	'occurrences.update',
	'occurrences.delete',
	'tasks.read',
	'tasks.create',
	'tasks.update',
	'wellbeing.read',
	'wellbeing.create',
	'work.read',
	'work.create',
	'work.update',
	'work.delete',
];

@Injectable()
export class PermissionsGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
			'permissions',
			[context.getHandler(), context.getClass()],
		);

		if (!requiredPermissions) {
			return true;
		}

		// Obtém as permissões do usuário a partir do request
		const request = context.switchToHttp().getRequest();
		if (!request.user) {
			throw new UnauthorizedException('Usuário não autenticado');
		}

		// Administradores possuem acesso a todas as permissões
		if (isAdminRole(request.user.role)) {
			return true;
		}

		const userPermissions: string[] = request.user?.permissions ?? [];
		const effectivePermissions = new Set([
			...userPermissions,
			...DEFAULT_EMPLOYEE_PERMISSIONS,
		]);

		const hasAllPermissions = requiredPermissions.every((permission) =>
			effectivePermissions.has(permission),
		);

		if (hasAllPermissions) {
			return true;
		}

		throw new ForbiddenException('Você não possui as permissões necessárias');
	}
}

