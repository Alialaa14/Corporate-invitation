import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  async toDataURL(payload: string) {
    return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M' });
  }

  async toBuffer(payload: string) {
    return QRCode.toBuffer(payload, { errorCorrectionLevel: 'M' });
  }

  async toStringSvg(payload: string) {
    return QRCode.toString(payload, { type: 'svg' });
  }
}
