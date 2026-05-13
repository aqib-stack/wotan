import { Module } from '@nestjs/common';

import { InsightsModule } from './insights/insights.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [InsightsModule, AuthModule],
})
export class AppModule {}