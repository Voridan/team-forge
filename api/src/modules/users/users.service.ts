import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicUser, toPublicUser } from '../../common/users/public-user';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return toPublicUser(user);
  }

  async updateById(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return toPublicUser(user);
  }

  async search(query: string, limit: number): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toPublicUser);
  }
}
