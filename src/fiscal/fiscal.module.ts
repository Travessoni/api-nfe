import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { FiscalController } from './controllers/fiscal.controller';
import { FiscalWebhookController } from './controllers/fiscal-webhook.controller';
import { FiscalSupabaseService } from './services/fiscal-supabase.service';
import { PedidoDataService } from './services/pedido-data.service';
import { FiscalEmissaoService } from './services/fiscal-emissao.service';
import { FiscalSyncService } from './services/fiscal-sync.service';
import { FocusNFeClientService } from './focus-nfe/focus-nfe-client.service';
import {
  FISCAL_QUEUE_NAME,
  FiscalEmissaoProcessor,
} from './processors/fiscal-emissao.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const restUrl = config.get<string>('UPSTASH_REDIS_REST_URL');
        // Senha do Redis (protocolo TCP) – NÃO é o REST Token. Pegue no dashboard Upstash em "Redis URL" ou "Password"
        const redisPassword = config.get<string>('UPSTASH_REDIS_PASSWORD');
        if (restUrl && redisPassword) {
          const host = new URL(restUrl).hostname;
          return {
            connection: {
              host,
              port: 6379,
              username: 'default',
              password: redisPassword,
              tls: {},
            },
          };
        }
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: FISCAL_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
      },
    }),
  ],
  controllers: [FiscalController, FiscalWebhookController],
  providers: [
    FiscalSupabaseService,
    PedidoDataService,
    FiscalEmissaoService,
    FiscalSyncService,
    FocusNFeClientService,
    FiscalEmissaoProcessor,
  ],
})
export class FiscalModule {}
