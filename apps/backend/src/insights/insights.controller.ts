import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
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
  ) {
    return this.insights.getBets(filter);
  }

  @Post('import/stake-json')
  @UseInterceptors(
  FilesInterceptor('files', 10, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  }),
)
  importStakeJson(@UploadedFiles() files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'At least one Stake archive JSON file is required.',
      );
    }

    return this.insights.importStakeJsonFiles(files);
  }
}