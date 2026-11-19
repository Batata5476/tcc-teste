import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';


@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

   // Verifica se o usuário tem a role necessária para acessar o recurso
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se não houver roles necessárias definidas, permite o acesso
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    const userRole = request.user?.role;

    // Se a roles necessarias ja estiverm incluidas no perfil de usuário, retorne true, se não retorne false
    if (requiredRoles.includes(userRole)) {
      return true;
    }

    throw new ForbiddenException('Seu perfil não pode acessar este recurso');
  }
}