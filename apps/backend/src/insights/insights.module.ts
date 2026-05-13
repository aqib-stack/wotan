import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'WOTAN_SECRET_KEY',
      signOptions: {
        expiresIn: '30d',
      },
    }),
  ],
  controllers: [InsightsController],
  providers: [InsightsService, PrismaService],
})
export class InsightsModule {}