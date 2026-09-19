import { IsEmail, IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateInvitationDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  numberOfGuests?: number;

  @IsString()
  @IsNotEmpty()
  eventId: string;
}

export class InvitationsQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  eventId?: string;
  status?: string;
  attendanceStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
