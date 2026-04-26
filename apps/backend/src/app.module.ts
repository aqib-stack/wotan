import { Module } from '@nestjs/common';
import { InsightsModule } from './insights/insights.module';

@Module({ imports: [InsightsModule] })
export class AppModule {}
