import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Channel, ChannelType } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teamId: string, dto: CreateChannelDto): Promise<Channel> {
    const existing = await this.prisma.channel.findUnique({
      where: { teamId_name: { teamId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`A channel named "${dto.name}" already exists`);
    }

    return this.prisma.channel.create({
      data: {
        teamId,
        name: dto.name,
        description: dto.description,
        type: ChannelType.PUBLIC,
      },
    });
  }

  async listForTeam(teamId: string): Promise<Channel[]> {
    return this.prisma.channel.findMany({
      where: { teamId, archivedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getById(teamId: string, channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, teamId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async update(teamId: string, channelId: string, dto: UpdateChannelDto): Promise<Channel> {
    await this.getById(teamId, channelId);

    if (dto.name) {
      const conflict = await this.prisma.channel.findUnique({
        where: { teamId_name: { teamId, name: dto.name } },
      });
      if (conflict && conflict.id !== channelId) {
        throw new ConflictException(`A channel named "${dto.name}" already exists`);
      }
    }

    return this.prisma.channel.update({
      where: { id: channelId },
      data: { name: dto.name, description: dto.description },
    });
  }

  async archive(teamId: string, channelId: string): Promise<void> {
    await this.getById(teamId, channelId);
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { archivedAt: new Date() },
    });
  }
}
