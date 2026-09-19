import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async scan(token: string) {
    const tokenHash = this.hashToken(token);

    // Find invitation by tokenHash
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation) {
      throw new NotFoundException({ success: false, message: 'Invalid Invitation' });
    }

    if (invitation.status === 'CANCELLED') {
      return { success: false, message: 'Invitation Cancelled' };
    }

    // Atomic conditional update using updateMany
    const result = await this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.invitation.updateMany({
        where: { id: invitation.id, attendanceStatus: 'NOT_ATTENDED' },
        data: { attendanceStatus: 'ATTENDED', attendedAt: new Date() },
      });

      if (updated.count === 1) {
        const refreshed = await prisma.invitation.findUnique({ where: { id: invitation.id } });
        return { status: 'ok', invitation: refreshed };
      }

      // Already attended
      const refreshed = await prisma.invitation.findUnique({ where: { id: invitation.id } });
      return { status: 'already', invitation: refreshed };
    });

    if (result.status === 'ok') {
      return {
        success: true,
        message: 'Attendance recorded successfully',
        data: {
          invitationId: result.invitation.id,
          fullName: result.invitation.fullName,
          company: result.invitation.company,
          attendedAt: result.invitation.attendedAt,
        },
      };
    }

    return {
      success: false,
      message: 'Already Checked In',
      data: {
        invitationId: result.invitation.id,
        fullName: result.invitation.fullName,
        company: result.invitation.company,
        firstAttendedAt: result.invitation.attendedAt,
      },
    };
  }
}
