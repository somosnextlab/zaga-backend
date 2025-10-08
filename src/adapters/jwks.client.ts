import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@shared/logger';
import { createRemoteJWKSet } from 'jose';

@Injectable()
export class JwksClientService {
  private readonly logger = new Logger(JwksClientService.name);
  private jwksClient: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly configService: ConfigService) {
    const jwksUrl = this.configService.get<string>('SUPABASE_JWKS_URL');

    if (jwksUrl && jwksUrl !== 'https://example.supabase.co/auth/v1/keys') {
      this.jwksClient = createRemoteJWKSet(new URL(jwksUrl));
      this.logger.log(`JWKS Client inicializado con URL: ${jwksUrl}`);
    } else {
      // En modo desarrollo, crear un JWKS client dummy
      this.jwksClient = createRemoteJWKSet(
        new URL('https://example.supabase.co/auth/v1/keys'),
      );
      this.logger.log('JWKS Client inicializado en modo desarrollo');
    }
  }

  getClient() {
    return this.jwksClient;
  }
}
