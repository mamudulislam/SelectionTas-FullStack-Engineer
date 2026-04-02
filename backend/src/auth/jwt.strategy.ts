import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // To prevent the 401 redirect loop, we trust the information in the cryptographically verified payload
  // instead of crashing if the database profile lookup has a momentary delay.
  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    
    // Return a basic user object from the token payload immediately
    // This allows the request to proceed. Guards on specific endpoints can do deeper checks.
    return {
      id: payload.sub,
      email: payload.email,
      // Provide fallbacks for name if needed, though usually fetched from DB on the page
      firstName: '',
      lastName: '',
    };
  }
}