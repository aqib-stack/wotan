import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { InsightsService } from './insights.service';

@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    private readonly jwtService: JwtService,
  ) {}

  private getUserIdFromAuthHeader(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const payload = this.jwtService.verify(token, {
        secret: 'WOTAN_SECRET_KEY',
      });

      if (!payload?.userId) {
        throw new UnauthorizedException('Invalid authentication token.');
      }

      return payload.userId as string;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }
  }

  @Get('summary')
  summary(@Headers('authorization') authHeader?: string) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getSummary(userId);
  }

  @Get('metrics')
  metrics(@Headers('authorization') authHeader?: string) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getMetrics(userId);
  }

  @Get('tilt-events')
  tiltEvents(@Headers('authorization') authHeader?: string) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getTiltEvents(userId);
  }

  @Get('heatmap')
  heatmap(@Headers('authorization') authHeader?: string) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getHeatmap(userId);
  }

  @Get('streak')
  streak(@Headers('authorization') authHeader?: string) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getStreak(userId);
  }

  @Get('bets')
  bets(
    @Headers('authorization') authHeader: string | undefined,
    @Query('filter') filter: 'all' | 'tilt' | 'win' | 'loss' = 'all',
    @Query('limit') limit?: string,
  ) {
    const userId = this.getUserIdFromAuthHeader(authHeader);
    return this.insights.getBets(userId, filter, Number(limit) || 200);
  }

  @Post('import/stake-json')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  importStakeJson(
    @Headers('authorization') authHeader: string | undefined,
    @UploadedFiles() files: any[],
    @Body('stakeToken') stakeToken?: string,
  ) {
    const userId = this.getUserIdFromAuthHeader(authHeader);

    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least one Stake archive JSON file is required.',
      );
    }

    return this.insights.importStakeJsonFiles(userId, files, stakeToken);
  }

  @Post('import/stake-browser')
  importStakeBrowser(
    @Headers('authorization') authHeader: string | undefined,
    @Body('entries') entries?: any[],
  ) {
    const userId = this.getUserIdFromAuthHeader(authHeader);

    if (!Array.isArray(entries)) {
      throw new BadRequestException(
        'Stake browser sync payload must include an entries array.',
      );
    }

    return this.insights.importStakeBrowserEntries(userId, entries);
  }

  @Post('import/stake-live')
  importStakeLive(
    @Headers('authorization') authHeader: string | undefined,
    @Body('stakeToken') stakeToken?: string,
    @Body('maxBets') maxBets?: number,
  ) {
    const userId = this.getUserIdFromAuthHeader(authHeader);

    if (!stakeToken?.trim()) {
      throw new BadRequestException(
        'Stake x-access-token is required. Connect Stake once, then use auto-sync.',
      );
    }

    return this.insights.importStakeLive(
      userId,
      stakeToken,
      Number(maxBets) || 200,
    );
  }
}