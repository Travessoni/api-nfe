import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { FiscalModule } from './fiscal/fiscal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FiscalModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
