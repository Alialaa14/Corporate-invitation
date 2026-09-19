import { IsNotEmpty, IsString } from 'class-validator';

export class ScanDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
