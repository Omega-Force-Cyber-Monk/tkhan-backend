/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('EmailService groomer approval email', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ messageId: 'message-1' });
  });

  it('sends a branded login-ready approval email', async () => {
    const values: Record<string, string> = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'admin@karoot.ca',
      SMTP_PASS: 'app-password',
      SMTP_FROM_EMAIL: 'admin@karoot.ca',
      SMTP_FROM_NAME: 'Karoot',
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    const service = new EmailService(config);

    await service.sendGroomerApprovalEmail(
      'groomer@example.com',
      'Taylor & Co',
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Karoot" <admin@karoot.ca>',
        to: 'groomer@example.com',
        subject: 'Your Karoot groomer profile has been approved',
        text: expect.stringContaining('You can now log in to Karoot'),
        html: expect.stringMatching(/Taylor &amp; Co/),
      }),
    );
  });
});
