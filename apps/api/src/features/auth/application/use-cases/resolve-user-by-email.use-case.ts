import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';

export interface ResolveUserByEmailInput {
  email: string;
}

export interface ResolveUserByEmailOutput {
  uuid: string;
  email: string;
  name: string;
}

export class ResolveUserByEmailUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(input: ResolveUserByEmailInput): Promise<ResolveUserByEmailOutput | null> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      return null;
    }

    return {
      uuid: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
