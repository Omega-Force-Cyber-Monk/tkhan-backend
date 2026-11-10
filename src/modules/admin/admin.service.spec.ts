/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Logger } from '@nestjs/common';

jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AdminService } from './admin.service';

describe('AdminService groomer approval', () => {
  const approvedGroomer = {
    id: 'profile-1',
    userId: 'groomer-1',
    approvalStatus: 'APPROVED',
    user: {
      id: 'groomer-1',
      email: 'groomer@example.com',
      fullName: 'Groomer Example',
    },
  };

  const createService = (
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) => {
    const prisma = {
      groomerProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: approvedGroomer.id,
          approvalStatus,
        }),
        update: jest.fn().mockResolvedValue(approvedGroomer),
      },
      adminActionLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };
    const emailService = {
      sendGroomerApprovalEmail: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new AdminService(prisma as any, emailService as any),
      prisma,
      emailService,
    };
  };

  it('approves the groomer and sends the approval email on first approval', async () => {
    const { service, prisma, emailService } = createService('PENDING');

    await expect(
      service.approveGroomer('admin-1', approvedGroomer.id),
    ).resolves.toEqual(approvedGroomer);

    expect(prisma.groomerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: approvedGroomer.id },
        data: expect.objectContaining({
          approvalStatus: 'APPROVED',
          approvedById: 'admin-1',
          user: { update: { status: 'ACTIVE', emailVerified: true } },
        }),
      }),
    );
    expect(emailService.sendGroomerApprovalEmail).toHaveBeenCalledWith(
      approvedGroomer.user.email,
      approvedGroomer.user.fullName,
    );
  });

  it('does not resend the email when the groomer is already approved', async () => {
    const { service, emailService } = createService('APPROVED');

    await service.approveGroomer('admin-1', approvedGroomer.id);

    expect(emailService.sendGroomerApprovalEmail).not.toHaveBeenCalled();
  });

  it('keeps the approval successful when email delivery fails', async () => {
    const { service, emailService } = createService('REJECTED');
    emailService.sendGroomerApprovalEmail.mockRejectedValue(
      new Error('SMTP unavailable'),
    );
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.approveGroomer('admin-1', approvedGroomer.id),
    ).resolves.toEqual(approvedGroomer);
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send approval email'),
    );

    logger.mockRestore();
  });
});
