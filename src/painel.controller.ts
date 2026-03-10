import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

@Controller('painel')
export class PainelController {
  @Get()
  getPainel(@Res() res: Response) {
    const indexPath = join(process.cwd(), 'public', 'index.html');
    res.sendFile(indexPath);
  }
}

