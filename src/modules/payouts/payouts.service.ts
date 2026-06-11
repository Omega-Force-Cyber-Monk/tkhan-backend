import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { paginate, paginated } from '../../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdminApproveWithdrawalRequestDto,
  AdminMarkWithdrawalPaidDto,
  AdminRejectWithdrawalRequestDto,
  CreateGroomerBankAccountDto,
  CreateWithdrawalRequestDto,
  UpdateGroomerBankAccountDto,
  WithdrawalRequestQueryDto,
} from './dto/payouts.dto';

const ACTIVE_WITHDRAWAL_REQUEST_STATUSES = ['REQUESTED', 'APPROVED', 'PAID'];
const PENDING_WITHDRAWAL_REQUEST_STATUSES = ['REQUESTED', 'APPROVED'];

const withdrawalRequestInclude = {
  bankAccount: true,
  groomer: {
    include: {
      user: true,
    },
  },
  items: {
    include: {
      payout: {
        include: {
          booking: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async releaseForBooking(bookingId: string) {
    const existingPayout = await this.prisma.payout.findUnique({
      where: { bookingId },
      include: {
        withdrawalItems: {
          include: {
            withdrawalRequest: {
              select: {
                id: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });
    if (existingPayout) return existingPayout;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        groomer: {
          include: {
            groomerProfile: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Booking must be completed before earning entry creation',
      );
    }

    const groomerProfile = booking.groomer.groomerProfile;
    if (!groomerProfile) {
      throw new BadRequestException('Booking groomer profile not found');
    }

    return this.prisma.payout.create({
      data: {
        bookingId,
        groomerId: groomerProfile.id,
        amount: booking.groomerEarningAmount,
        platformFee: booking.platformFeeAmount,
        currency: booking.payments[0]?.currency ?? 'usd',
      },
      include: {
        withdrawalItems: {
          include: {
            withdrawalRequest: {
              select: {
                id: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });
  }

  list() {
    return this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        booking: true,
        groomer: {
          include: { user: true },
        },
        withdrawalItems: {
          include: {
            withdrawalRequest: {
              select: {
                id: true,
                amountRequested: true,
                amountPaid: true,
                status: true,
                requestedAt: true,
                paidAt: true,
              },
            },
          },
        },
      },
    });
  }

  async summary(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      balance,
      week,
      month,
      weekApprovedPayout,
      monthApprovedPayout,
      recentEarnings,
      recentWithdrawalRequests,
    ] =
      await Promise.all([
        this.getBalanceSummary(groomer.id),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            createdAt: { gte: weekStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.payout.aggregate({
          where: {
            groomerId: groomer.id,
            createdAt: { gte: monthStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: {
            groomerId: groomer.id,
            status: { in: ['APPROVED', 'PAID'] as any },
            reviewedAt: { gte: weekStart },
          },
          _sum: { amountRequested: true },
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: {
            groomerId: groomer.id,
            status: { in: ['APPROVED', 'PAID'] as any },
            reviewedAt: { gte: monthStart },
          },
          _sum: { amountRequested: true },
        }),
        this.prisma.payout.findMany({
          where: { groomerId: groomer.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            booking: true,
            withdrawalItems: {
              include: {
                withdrawalRequest: {
                  select: {
                    id: true,
                    status: true,
                    paidAt: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.withdrawalRequest.findMany({
          where: { groomerId: groomer.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            bankAccount: true,
          },
        }),
      ]);

    return {
      ...balance,
      thisWeekIncome: week._sum.amount ?? 0,
      thisMonthIncome: month._sum.amount ?? 0,
      thisWeekApprovedPayout: weekApprovedPayout._sum.amountRequested ?? 0,
      thisMonthApprovedPayout: monthApprovedPayout._sum.amountRequested ?? 0,
      recentEarnings,
      recentWithdrawalRequests,
    };
  }

  async listBankAccounts(userId: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    return this.prisma.groomerBankAccount.findMany({
      where: { groomerId: groomer.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createBankAccount(
    userId: string,
    dto: CreateGroomerBankAccountDto,
  ) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const existingCount = await this.prisma.groomerBankAccount.count({
      where: { groomerId: groomer.id },
    });

    return this.prisma.$transaction(async (tx) => {
      const makeDefault = dto.isDefault || existingCount === 0;
      if (makeDefault) {
        await tx.groomerBankAccount.updateMany({
          where: { groomerId: groomer.id },
          data: { isDefault: false },
        });
      }

      return tx.groomerBankAccount.create({
        data: {
          groomerId: groomer.id,
          accountHolderName: dto.accountHolderName,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          transitNumber: dto.transitNumber,
          institutionNumber: dto.institutionNumber,
          branchName: dto.branchName,
          isDefault: makeDefault,
        },
      });
    });
  }

  async updateBankAccount(
    userId: string,
    id: string,
    dto: UpdateGroomerBankAccountDto,
  ) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    await this.assertBankAccountOwner(groomer.id, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.groomerBankAccount.updateMany({
          where: { groomerId: groomer.id },
          data: { isDefault: false },
        });
      }

      return tx.groomerBankAccount.update({
        where: { id },
        data: {
          ...(dto.accountHolderName && {
            accountHolderName: dto.accountHolderName,
          }),
          ...(dto.bankName && { bankName: dto.bankName }),
          ...(dto.accountNumber && { accountNumber: dto.accountNumber }),
          ...(dto.transitNumber && { transitNumber: dto.transitNumber }),
          ...(dto.institutionNumber && {
            institutionNumber: dto.institutionNumber,
          }),
          ...(dto.branchName !== undefined && { branchName: dto.branchName }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });
  }

  async deleteBankAccount(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const bankAccount = await this.prisma.groomerBankAccount.findFirst({
      where: { id, groomerId: groomer.id },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');

    const openRequestCount = await this.prisma.withdrawalRequest.count({
      where: {
        bankAccountId: id,
        status: { in: ['REQUESTED', 'APPROVED'] },
      },
    });
    if (openRequestCount > 0) {
      throw new BadRequestException(
        'Cannot delete a bank account with pending withdrawal requests',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.groomerBankAccount.delete({ where: { id } });

      if (bankAccount.isDefault) {
        const fallbackAccount = await tx.groomerBankAccount.findFirst({
          where: { groomerId: groomer.id },
          orderBy: { createdAt: 'desc' },
        });
        if (fallbackAccount) {
          await tx.groomerBankAccount.update({
            where: { id: fallbackAccount.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true };
    });
  }

  async setDefaultBankAccount(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    await this.assertBankAccountOwner(groomer.id, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.groomerBankAccount.updateMany({
        where: { groomerId: groomer.id },
        data: { isDefault: false },
      });
      return tx.groomerBankAccount.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  async listMyWithdrawalRequests(
    userId: string,
    dto: WithdrawalRequestQueryDto,
  ) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const where: any = {
      groomerId: groomer.id,
      ...(dto.status && { status: dto.status }),
    };
    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: withdrawalRequestInclude,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async createWithdrawalRequest(
    userId: string,
    dto: CreateWithdrawalRequestDto,
  ) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const amountRequested = this.toAmount(dto.amount);
    if (amountRequested <= 0) {
      throw new BadRequestException(
        'Withdrawal request amount must be greater than zero',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const bankAccount = await tx.groomerBankAccount.findFirst({
        where: {
          id: dto.bankAccountId,
          groomerId: groomer.id,
        },
      });
      if (!bankAccount) {
        throw new NotFoundException('Bank account not found');
      }

      const allocations = await this.buildWithdrawalAllocations(
        tx,
        groomer.id,
        amountRequested,
      );
      if (allocations.length === 0) {
        throw new BadRequestException(
          'No completed earnings are available for withdrawal',
        );
      }

      const request = await tx.withdrawalRequest.create({
        data: {
          groomerId: groomer.id,
          bankAccountId: bankAccount.id,
          amountRequested,
          currency: allocations[0]?.currency ?? 'usd',
          items: {
            create: allocations.map((allocation) => ({
              payoutId: allocation.payoutId,
              allocatedAmount: allocation.allocatedAmount,
            })),
          },
        },
        include: withdrawalRequestInclude,
      });

      return request;
    });
  }

  async cancelWithdrawalRequest(userId: string, id: string) {
    const groomer = await this.prisma.groomerProfile.findUniqueOrThrow({
      where: { userId },
    });
    const request = await this.prisma.withdrawalRequest.findFirst({
      where: {
        id,
        groomerId: groomer.id,
      },
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Only requested withdrawals can be cancelled',
      );
    }
    return this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        reviewedAt: new Date(),
      },
      include: withdrawalRequestInclude,
    });
  }

  async listWithdrawalRequests(dto: WithdrawalRequestQueryDto) {
    const where: any = {
      ...(dto.status && { status: dto.status }),
      ...(dto.groomerId && { groomerId: dto.groomerId }),
    };
    const [items, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        ...paginate(dto.page, dto.limit),
        orderBy: { [dto.sortBy]: dto.sortOrder },
        include: withdrawalRequestInclude,
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);
    return paginated(items, total, dto.page, dto.limit);
  }

  async approveWithdrawalRequest(
    adminId: string,
    id: string,
    dto: AdminApproveWithdrawalRequestDto,
  ) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: withdrawalRequestInclude,
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(
        'Only requested withdrawals can be approved',
      );
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminNote: dto.note,
        reviewedAt: new Date(),
      },
      include: withdrawalRequestInclude,
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: updated.groomer.userId,
        action: 'WITHDRAWAL_REQUEST_APPROVED',
        note: dto.note,
      },
    });
    await this.notifications.create(
      updated.groomer.userId,
      'ADMIN_ACTION',
      'Withdrawal request approved',
      'Your withdrawal request has been approved and is awaiting payment.',
      {
        targetScreen: 'withdrawal_details',
        withdrawalRequestId: updated.id,
      },
    );
    return updated;
  }

  async rejectWithdrawalRequest(
    adminId: string,
    id: string,
    dto: AdminRejectWithdrawalRequestDto,
  ) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: withdrawalRequestInclude,
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (!['REQUESTED', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException(
        'Only open withdrawal requests can be rejected',
      );
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNote: dto.reason,
        reviewedAt: new Date(),
      },
      include: withdrawalRequestInclude,
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: updated.groomer.userId,
        action: 'WITHDRAWAL_REQUEST_REJECTED',
        note: dto.reason,
      },
    });
    await this.notifications.create(
      updated.groomer.userId,
      'ADMIN_ACTION',
      'Withdrawal request rejected',
      dto.reason,
      {
        targetScreen: 'withdrawal_details',
        withdrawalRequestId: updated.id,
      },
    );
    return updated;
  }

  async markWithdrawalRequestPaid(
    adminId: string,
    id: string,
    dto: AdminMarkWithdrawalPaidDto,
  ) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: withdrawalRequestInclude,
    });
    if (!request) throw new NotFoundException('Withdrawal request not found');
    if (!['REQUESTED', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException(
        'Only open withdrawal requests can be marked paid',
      );
    }

    const updated = await this.prisma.withdrawalRequest.update({
      where: { id },
      data: {
        status: 'PAID',
        amountPaid: request.amountRequested,
        transferReference: dto.transferReference,
        adminNote: dto.note,
        reviewedAt: request.reviewedAt ?? new Date(),
        paidAt: new Date(),
      },
      include: withdrawalRequestInclude,
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: updated.groomer.userId,
        action: 'WITHDRAWAL_REQUEST_PAID',
        note: dto.note ?? dto.transferReference,
      },
    });
    await this.notifications.create(
      updated.groomer.userId,
      'ADMIN_ACTION',
      'Withdrawal request paid',
      'Your withdrawal has been marked as paid by the admin.',
      {
        targetScreen: 'withdrawal_details',
        withdrawalRequestId: updated.id,
        transferReference: updated.transferReference,
      },
    );
    return updated;
  }

  private async getBalanceSummary(groomerId: string) {
    const [earned, pending, paid] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { groomerId },
        _sum: { amount: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          groomerId,
          status: { in: PENDING_WITHDRAWAL_REQUEST_STATUSES as any },
        },
        _sum: { amountRequested: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: {
          groomerId,
          status: 'PAID',
        },
        _sum: { amountPaid: true },
      }),
    ]);

    const totalEarned = Number(earned._sum.amount ?? 0);
    const pendingWithdrawal = Number(pending._sum.amountRequested ?? 0);
    const paidOutTotal = Number(paid._sum.amountPaid ?? 0);
    const availableBalance = Number(
      (totalEarned - pendingWithdrawal - paidOutTotal).toFixed(2),
    );

    return {
      totalEarned,
      availableBalance,
      pendingWithdrawal,
      paidOutTotal,
    };
  }

  private async assertBankAccountOwner(groomerId: string, bankAccountId: string) {
    const bankAccount = await this.prisma.groomerBankAccount.findFirst({
      where: {
        id: bankAccountId,
        groomerId,
      },
    });
    if (!bankAccount) throw new NotFoundException('Bank account not found');
    return bankAccount;
  }

  private async buildWithdrawalAllocations(
    tx: any,
    groomerId: string,
    requestedAmount: number,
  ) {
    const payouts = await tx.payout.findMany({
      where: { groomerId },
      orderBy: { createdAt: 'asc' },
      include: {
        withdrawalItems: {
          include: {
            withdrawalRequest: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    let remaining = requestedAmount;
    const allocations: Array<{
      payoutId: string;
      allocatedAmount: number;
      currency: string;
    }> = [];

    for (const payout of payouts) {
      const allocatedAlready = payout.withdrawalItems
        .filter((item: any) =>
          ACTIVE_WITHDRAWAL_REQUEST_STATUSES.includes(
            item.withdrawalRequest.status,
          ),
        )
        .reduce(
          (sum: number, item: any) => sum + Number(item.allocatedAmount),
          0,
        );
      const availableFromPayout = Number(payout.amount) - allocatedAlready;
      if (availableFromPayout <= 0) continue;

      const allocatedAmount = Number(
        Math.min(availableFromPayout, remaining).toFixed(2),
      );
      allocations.push({
        payoutId: payout.id,
        allocatedAmount,
        currency: payout.currency,
      });
      remaining = Number((remaining - allocatedAmount).toFixed(2));
      if (remaining <= 0) break;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        'Withdrawal amount exceeds available balance',
      );
    }

    return allocations;
  }

  private toAmount(value: number) {
    return Number(Number(value).toFixed(2));
  }
}
