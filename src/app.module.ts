import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { FiscalModule } from './fiscal/fiscal.module';
import { FinancialModule } from './financial/financial.module';
import { PainelController } from './painel.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FiscalModule,
    FinancialModule,
  ],
  controllers: [AppController, PainelController],
})
export class AppModule {}
