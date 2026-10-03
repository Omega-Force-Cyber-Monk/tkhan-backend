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
      throw new InternalServerErrorException(
        'SMTP_FROM_EMAIL is not configured',
      );
    }

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Verify your Karoot account',
        text: [
          `Hi ${fullName},`,
          '',
          `Your Karoot verification OTP is: ${otp}`,
          'This OTP will expire in 10 minutes.',
          '',
          'Do not share this code with anyone. Karoot will never ask for this code via phone or chat.',
          '',
          'If you did not request this, please ignore this email.',
        ].join('\n'),
        html: this.renderVerificationOtpEmail(fullName, otp),
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

  private renderVerificationOtpEmail(fullName: string, otp: string) {
    const safeName = this.escapeHtml(fullName);
    const safeOtp = this.escapeHtml(otp);
    const supportEmail =
      this.config.get<string>('SUPPORT_EMAIL') ||
      this.config.get<string>('SMTP_FROM_EMAIL') ||
      'support@karoot.com';
    const safeSupportEmail = this.escapeHtml(supportEmail);

    return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background:#fbf6ef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbf6ef;margin:0;padding:22px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 12px 30px rgba(24,33,52,0.08);">
            <tr>
              <td style="padding:28px 30px 26px;font-family:Arial,Helvetica,sans-serif;color:#1f2b44;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom:28px;">
                      <div style="font-size:32px;line-height:1;font-weight:900;color:#ff4b1f;letter-spacing:-1px;">Karoot</div>
                      <div style="font-size:14px;line-height:1.4;color:#243149;margin-top:8px;">Connecting Pets With Trusted Care</div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <div style="font-size:34px;line-height:1.08;font-weight:900;letter-spacing:-1px;color:#151515;">
                        Verify Your <span style="color:#ff4b1f;">Email</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;line-height:1.55;color:#243149;">
                      <p style="margin:0 0 12px;font-weight:700;">Hi ${safeName},</p>
                      <p style="margin:0 0 20px;">Thanks for joining Karoot. Please use the verification code below to confirm your email address.</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 0 12px;">
                      <table role="presentation" width="72%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #ffc5b3;background:#fff7f2;border-radius:10px;">
                        <tr>
                          <td align="center" style="padding:18px 10px;font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1;font-weight:900;letter-spacing:10px;color:#ff4b1f;">
                            ${safeOtp}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size:14px;line-height:1.5;color:#5f687a;padding-bottom:22px;">
                      This code will expire in 10 minutes.
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:24px;font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:15px;line-height:1.4;font-weight:800;color:#d92d20;">Do not share this code with anyone.</div>
                      <div style="font-size:13px;line-height:1.45;color:#d92d20;margin-top:4px;">Karoot will never ask for this code via phone or chat.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px solid #d9dde5;padding-top:20px;text-align:center;font-size:13px;line-height:1.55;color:#4b566b;">
                      <div>If you didn&apos;t request this email, you can safely ignore it.</div>
                      <div>Need help? Contact us at <a href="mailto:${safeSupportEmail}" style="color:#ff4b1f;text-decoration:none;">${safeSupportEmail}</a></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private toEmailDeliveryException(
    error: unknown,
    host?: string,
    port?: number,
  ) {
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
          'OTP email could not be sent: SMTP authentication failed. Check SMTP_USER and SMTP_PASS in the deployed environment.',
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
          'OTP email could not be sent: SMTP connection timeout. The deployed server could not connect to the configured SMTP host. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and deployed environment variables.',
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
        'OTP email could not be sent because the SMTP server returned an unexpected error.',
      reason: 'SMTP_DELIVERY_FAILED',
      smtpHost: server,
      providerCode: code,
      providerResponseCode: responseCode,
    });
  }
}
