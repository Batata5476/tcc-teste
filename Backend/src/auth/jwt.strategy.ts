import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  // o método validate é chamado automaticamente pelo Passport após ser verifcado o token JWT.
  // Ele recebe o payLoad do token decodificado e retorna o objeto que será anexado ao request.user.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return {
      sub: payload.sub,
      empresa_id: payload.empresa_id,
      role: payload.role,
      type: payload.type || (payload.role === 'Administrador Master' ? 'company' : 'user'),
      permissions: payload.permissions,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
