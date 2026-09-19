import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    const user = await this.usersService.create(body.name, body.email, body.password);
    return { success: true, user: { id: user.id, email: user.email, name: user.name } };
  }
}
