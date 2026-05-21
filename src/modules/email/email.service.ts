import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendBuyerVerificationOtp(email: string, fullName: string, otp: string) {
    const transporter = this.createTransporter();
    const fromName = this.config.get<string>('SMTP_FROM_NAME') || 'Tkhan';
    const fromEmail = this.config.get<string>('SMTP_FROM_EMAIL');

    if (!fromEmail) {
      throw new InternalServerErrorException('SMTP_FROM_EMAIL is not configured');
    }

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Verify your Tkhan account',
      text: [
        `Hi ${fullName},`,
        '',
        `Your Tkhan verification OTP is: ${otp}`,
        'This OTP will expire in 10 minutes.',
        '',
        'If you did not request this, please ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; color: #162033; line-height: 1.6;">
          <p>Hi ${this.escapeHtml(fullName)},</p>
          <p>Your Tkhan verification OTP is:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${this.escapeHtml(otp)}</p>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  private createTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    if (!host || !user || !pass) {
      throw new InternalServerErrorException(
        'SMTP credentials are not configured',
      );
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
