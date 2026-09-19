import { Body, Controller, Get, Post, UploadedFile, UseInterceptors, Query, Param, Res } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto, InvitationsQueryDto } from './dto/create-invitation.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  async create(@Body() dto: CreateInvitationDto) {
    return this.invitationsService.create(dto);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File, @Body('eventId') eventId: string) {
    const job = await this.invitationsService.enqueueImport(file.buffer, file.mimetype, eventId);
    return { jobId: job.id };
  }

  @Get('import/:id')
  async importStatus(@Param('id') id: string) {
    return this.invitationsService.getImportJobStatus(id);
  }

  @Get()
  async list(@Query() query: InvitationsQueryDto) {
    return this.invitationsService.list(query);
  }

  @Get('export')
  async export(@Query() query: InvitationsQueryDto, @Res() res: Response) {
    const { buffer, filename, mime } = await this.invitationsService.export(query);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
