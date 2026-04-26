import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PrismaService } from './prisma.service';

@Module({ controllers: [InsightsController], providers: [InsightsService, PrismaService] })
export class InsightsModule {}
