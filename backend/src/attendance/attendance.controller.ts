import { Body, Controller, Post } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ScanDto } from './dto/scan.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('scan')
  async scan(@Body() dto: ScanDto) {
    return this.attendanceService.scan(dto.token);
  }
}
