import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InsightsService } from './insights.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('summary')
  summary() {
    return this.insights.getSummary();
  }

  @Get('metrics')
  metrics() {
    return this.insights.getMetrics();
  }

  @Get('tilt-events')
  tiltEvents() {
    return this.insights.getTiltEvents();
  }

  @Get('heatmap')
  heatmap() {
    return this.insights.getHeatmap();
  }

  @Get('streak')
  streak() {
    return this.insights.getStreak();
  }

  @Get('bets')
  bets(
    @Query('filter') filter: 'all' | 'tilt' | 'win' | 'loss' = 'all',
    @Query('limit') limit?: string,
  ) {
    return this.insights.getBets(filter, Number(limit) || 200);
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
    @UploadedFiles() files: any[],
    @Body('stakeToken') stakeToken?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least one Stake archive JSON file is required.',
      );
    }

    return this.insights.importStakeJsonFiles(files, stakeToken);
  }


  @Post('import/stake-browser')
  importStakeBrowser(@Body('entries') entries?: any[]) {
    if (!Array.isArray(entries)) {
      throw new BadRequestException('Stake browser sync payload must include an entries array.');
    }

    return this.insights.importStakeBrowserEntries(entries);
  }

  @Post('import/stake-live')
  importStakeLive(
    @Body('stakeToken') stakeToken?: string,
    @Body('maxBets') maxBets?: number,
  ) {
    if (!stakeToken?.trim()) {
      throw new BadRequestException(
        'Stake x-access-token is required. Connect Stake once, then use auto-sync.',
      );
    }

    return this.insights.importStakeLive(stakeToken, Number(maxBets) || 200);
  }
}
