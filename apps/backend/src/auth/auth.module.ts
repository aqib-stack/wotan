import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'WOTAN_SECRET_KEY',
      signOptions: {
        expiresIn: '30d',
      },
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService, PrismaService],
})
export class AuthModule {}