import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
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

    try {
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
    } catch (error) {
      const host = this.config.get<string>('SMTP_HOST');
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      throw this.toEmailDeliveryException(error, host, port);
    }
  }

  private createTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const connectionTimeout = Number(
      this.config.get<string>('SMTP_CONNECTION_TIMEOUT_MS') || 10000,
    );
    const greetingTimeout = Number(
      this.config.get<string>('SMTP_GREETING_TIMEOUT_MS') || 10000,
    );
    const socketTimeout = Number(
      this.config.get<string>('SMTP_SOCKET_TIMEOUT_MS') || 15000,
    );

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
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
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

  private toEmailDeliveryException(error: unknown, host?: string, port?: number) {
    const smtpError = error as {
      code?: string;
      command?: string;
      responseCode?: number;
      message?: string;
    };
    const code = smtpError.code;
    const responseCode = smtpError.responseCode;
    const server = host && port ? `${host}:${port}` : 'SMTP server';

    if (code === 'EAUTH' || responseCode === 535) {
      return new BadGatewayException({
        message:
          'OTP email could not be sent: SMTP authentication failed. Check SMTP_USER and SMTP_PASS app password in the deployed environment.',
        reason: 'SMTP_AUTH_FAILED',
        smtpHost: server,
      });
    }

    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKET' ||
      smtpError.message?.toLowerCase().includes('timeout')
    ) {
      return new ServiceUnavailableException({
        message:
          'OTP email could not be sent: SMTP connection timeout. The deployed server could not connect to the configured SMTP host. Check SMTP_HOST/SMTP_PORT, Render environment variables, or use a production email provider.',
        reason: 'SMTP_CONNECTION_TIMEOUT',
        smtpHost: server,
      });
    }

    if (code === 'ECONNECTION' || code === 'ECONNREFUSED') {
      return new ServiceUnavailableException({
        message:
          'OTP email could not be sent: SMTP connection failed. Check SMTP host, port, secure setting, and provider network access.',
        reason: 'SMTP_CONNECTION_FAILED',
        smtpHost: server,
      });
    }

    return new BadGatewayException({
      message:
        'OTP email could not be sent because the SMTP provider returned an unexpected error.',
      reason: 'SMTP_DELIVERY_FAILED',
      smtpHost: server,
      providerCode: code,
      providerResponseCode: responseCode,
    });
  }
}
