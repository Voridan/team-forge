import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleProvider } from './providers/google.provider';
import { OAuthProvider } from './oauth.types';

@Injectable()
export class OAuthProviderRegistry {
  private readonly providers = new Map<string, OAuthProvider>();

  constructor(googleProvider: GoogleProvider) {
    this.register(googleProvider);
  }

  get(name: string): OAuthProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new BadRequestException(`Unsupported OAuth provider: ${name}`);
    }
    return provider;
  }

  private register(provider: OAuthProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }
}
