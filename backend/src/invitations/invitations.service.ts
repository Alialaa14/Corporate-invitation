import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';
import { QrService } from '../qr/qr.service';
import * as csv from 'fast-csv';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';

type ImportResult = {
  totalRows: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
};

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService, private qrService: QrService) {}

  private generateInvitationCode() {
    return 'INV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  private generateToken() {
    return crypto.randomBytes(48).toString('hex');
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(dto: CreateInvitationDto) {
    // verify event exists
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new BadRequestException('Event not found');

    // detect duplicates (event + email or phone)
    if (dto.email) {
      const existing = await this.prisma.invitation.findFirst({ where: { eventId: dto.eventId, email: dto.email } });
      if (existing) throw new BadRequestException('Duplicate email for this event');
    }

    const invitationCode = this.generateInvitationCode();
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const created = await this.prisma.invitation.create({
      data: {
        eventId: dto.eventId,
        invitationCode,
        tokenHash,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        jobTitle: dto.jobTitle,
        numberOfGuests: dto.numberOfGuests,
      },
    });

    // Generate QR payload (configurable scheme)
    const qrPayload = `https://your-domain.com/invitation/verify/${token}`;
    const qrDataUrl = await this.qrService.toDataURL(qrPayload);

    return {
      ...created,
      qr: { payload: qrPayload, dataUrl: qrDataUrl },
      rawToken: token, // returned once; do not store raw token
    };
  }

  async importFromCsv(buffer: Buffer, eventId: string): Promise<ImportResult> {
    // Deprecated: use enqueueImport for job-based imports
    const results: ImportResult = { totalRows: 0, successful: 0, failed: 0, errors: [] };
    const stream = Readable.from(buffer.toString());
    return new Promise((resolve, reject) => {
      const parser = csv
        .parse({ headers: true, trim: true })
        .on('error', (error) => reject(error))
        .on('data', async (row) => {
          parser.pause();
          results.totalRows++;
          try {
            const dto: CreateInvitationDto = {
              fullName: row['Full Name'] || row['fullName'] || row['name'],
              email: row['Email'] || row['email'] || undefined,
              phone: row['Phone'] || row['phone'] || undefined,
              company: row['Company'] || row['company'] || undefined,
              jobTitle: row['Job Title'] || row['jobTitle'] || undefined,
              numberOfGuests: row['Number Of Guests'] ? parseInt(row['Number Of Guests'], 10) : undefined,
              eventId,
            } as any;

            if (!dto.fullName) throw new Error('Missing fullName');

            if (dto.email) {
              const existing = await this.prisma.invitation.findFirst({ where: { eventId, email: dto.email } });
              if (existing) throw new Error('Duplicate email');
            }

            await this.create(dto);
            results.successful++;
          } catch (err: any) {
            results.failed++;
            results.errors.push({ row: results.totalRows, reason: err.message || 'Invalid row' });
          } finally {
            parser.resume();
          }
        })
        .on('end', () => resolve(results));

      stream.pipe(parser);
    });
  }

  async enqueueImport(buffer: Buffer, mimetype: string, eventId: string) {
    // Create ImportJob
    const job = await this.prisma.importJob.create({ data: { status: 'PENDING' } });

    // Process asynchronously (fire-and-forget). In production use a queue (Bull/Redis)
    (async () => {
      await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS' } });
      try {
        let summary: any = null;
        if (mimetype.includes('sheet') || mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          summary = await this.processExcel(buffer, eventId);
        } else {
          summary = await this.processCsvBuffer(buffer, eventId);
        }
        await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', summary } });
      } catch (err: any) {
        await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'FAILED', summary: { error: err.message } } });
      }
    })();

    return job;
  }

  async getImportJobStatus(id: string) {
    return this.prisma.importJob.findUnique({ where: { id } });
  }

  private async processCsvBuffer(buffer: Buffer, eventId: string) {
    const rows: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from([buffer]);
      const parser = csv.parse({ headers: true, trim: true })
        .on('error', (err) => reject(err))
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve());
      stream.pipe(parser as any);
    });
    return this.batchInsertRows(rows, eventId);
  }

  private async processExcel(buffer: Buffer, eventId: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return this.batchInsertRows(rows as any[], eventId);
  }

  private async batchInsertRows(rows: any[], eventId: string) {
    const summary = { totalRows: rows.length, successful: 0, failed: 0, errors: [] as any[] };
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      // Pre-check duplicates by email or phone for this batch
      const emails = batch.map((r) => r['Email'] || r['email']).filter(Boolean);
      const phones = batch.map((r) => r['Phone'] || r['phone']).filter(Boolean);
      const existing = await this.prisma.invitation.findMany({ where: { eventId, OR: [{ email: { in: emails.length ? emails : [''] } }, { phone: { in: phones.length ? phones : [''] } }] } });
      const existingEmails = new Set(existing.map((e) => e.email).filter(Boolean));
      const existingPhones = new Set(existing.map((e) => e.phone).filter(Boolean));

      const txOps: any[] = [];
      for (const [idx, row] of batch.entries()) {
        const dto: CreateInvitationDto = {
          fullName: row['Full Name'] || row['fullName'] || row['name'],
          email: row['Email'] || row['email'] || undefined,
          phone: row['Phone'] || row['phone'] || undefined,
          company: row['Company'] || row['company'] || undefined,
          jobTitle: row['Job Title'] || row['jobTitle'] || undefined,
          numberOfGuests: row['Number Of Guests'] ? parseInt(row['Number Of Guests'], 10) : undefined,
          eventId,
        } as any;

        if (!dto.fullName) {
          summary.failed++;
          summary.errors.push({ row: i + idx + 1, reason: 'Missing fullName' });
          continue;
        }

        if (dto.email && existingEmails.has(dto.email)) {
          summary.failed++;
          summary.errors.push({ row: i + idx + 1, reason: 'Duplicate email' });
          continue;
        }

        if (dto.phone && existingPhones.has(dto.phone)) {
          summary.failed++;
          summary.errors.push({ row: i + idx + 1, reason: 'Duplicate phone' });
          continue;
        }

        const invitationCode = this.generateInvitationCode();
        const token = this.generateToken();
        const tokenHash = this.hashToken(token);

        txOps.push({
          eventId: dto.eventId,
          invitationCode,
          tokenHash,
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          company: dto.company,
          jobTitle: dto.jobTitle,
          numberOfGuests: dto.numberOfGuests,
        });

        summary.successful++;
      }

      // Insert batch in single transaction
      try {
        await this.prisma.$transaction(
          txOps.map((d) => this.prisma.invitation.create({ data: d }))
        );
      } catch (err: any) {
        // If transaction failed, mark all as failed
        summary.failed += txOps.length;
        summary.successful -= txOps.length;
        summary.errors.push({ reason: 'DB error in batch', detail: err.message });
      }
    }
    return summary;
  }

  async list(query: any) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.eventId) where.eventId = query.eventId;
    if (query.status) where.status = query.status;
    if (query.attendanceStatus) where.attendanceStatus = query.attendanceStatus;
    if (query.search) {
      const s = query.search;
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { company: { contains: s, mode: 'insensitive' } },
        { invitationCode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invitation.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.invitation.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async export(query: any) {
    const { data } = await this.list(query);
    // Generate CSV buffer
    const rows = data.map((d) => ({
      Name: d.fullName,
      Company: d.company,
      Email: d.email,
      Phone: d.phone,
      JobTitle: d.jobTitle,
      InvitationStatus: d.status,
      AttendanceStatus: d.attendanceStatus,
      AttendedAt: d.attendedAt,
      CreatedAt: d.createdAt,
    }));

    const csvStream = csv.format({ headers: true });
    const chunks: Buffer[] = [];
    return await new Promise<any>((resolve, reject) => {
      csvStream.on('error', (err) => reject(err));
      csvStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      csvStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, filename: `invitations_export_${Date.now()}.csv`, mime: 'text/csv' });
      });
      for (const row of rows) csvStream.write(row);
      csvStream.end();
    });
  }
}
