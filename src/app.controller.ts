import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      ok: true,
      message: 'API NFe Fiscal',
      painel: '/painel/',
      fiscal: {
        emitir: 'POST /fiscal/emitir/:pedidoId',
        listar: 'GET /fiscal/invoices',
        sync: 'POST /fiscal/sync',
        xml: 'GET /fiscal/:invoiceId/xml',
        pdf: 'GET /fiscal/:invoiceId/pdf',
        webhook: 'POST /fiscal/webhook/focusnfe',
      },
    };
  }
}
