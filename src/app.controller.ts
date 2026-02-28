import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Redirect('/painel/', 301)
  root() {
    return { url: '/painel/' };
  }
}
