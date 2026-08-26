import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderNotificationTemplate } from '../notifications/notification-templates';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterBuyerDto,
  RegisterGroomerDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  async registerBuyer(dto: RegisterBuyerDto) {
    await this.ensureEmailFree(dto.email);
    const password = await this.hash(dto.password);
    const emailVerificationOtp = this.generateOtp();
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email.toLowerCase(),
        password,
        streetAddress: dto.streetAddress,
        unitSuite: dto.unitSuite,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        role: 'BUYER',
        status: 'PENDING_EMAIL_VERIFICATION',
        emailVerificationToken: await this.hash(emailVerificationOtp),
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        buyerProfile: { create: {} },
      },
      include: { buyerProfile: true },
    });
    try {
      await this.emailService.sendBuyerVerificationOtp(
        user.email,
        user.fullName,
        emailVerificationOtp,
      );
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } });
      if (error instanceof HttpException) {
        throw error;
      }
      const message =
        error instanceof Error &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'Failed to send verification OTP email';
      throw new InternalServerErrorException(
        message,
      );
    }
    return {
      user: sanitizeUser(user),
      message:
        'Buyer registered. A verification OTP has been sent to the email address.',
    };
  }

  async registerGroomer(dto: RegisterGroomerDto) {
    await this.ensureEmailFree(dto.email);
    if (!dto.idFrontImage || !dto.idBackImage) {
      throw new BadRequestException('ID front and back images are required');
    }
    const password = await this.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email.toLowerCase(),
        password,
        profileImage: dto.profileImage,
        streetAddress: dto.streetAddress,
        unitSuite: dto.unitSuite,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        role: 'GROOMER',
        status: 'INACTIVE',
        groomerProfile: {
          create: {
            experienceYears: dto.experienceYears,
            legalFullName: dto.legalFullName,
            idNumber: dto.idNumber,
            idType: dto.idType,
            businessName: dto.businessName,
            serviceArea: dto.serviceArea,
            businessAddress: dto.businessAddress,
            gstHstRegistrationNumber:
              dto.gstHstRegistrationNumber?.trim() || undefined,
            idFrontImage: dto.idFrontImage,
            idBackImage: dto.idBackImage,
            selfieWithId: dto.selfieWithId,
            certifications: (dto.certifications ?? []) as any,
            serviceModes: dto.serviceModes ?? [],
            approvalStatus: 'PENDING',
          },
        },
      },
      include: { groomerProfile: true },
    });
    const notification = renderNotificationTemplate('ADMIN_NEW_GROOMER', {
      GroomerName: user.fullName,
    });
    await this.notifications.createForAdmins(
      'ADMIN_ACTION',
      notification.title,
      notification.body,
      {
        targetScreen: 'groomer_approval',
        groomerId: user.groomerProfile?.id,
        userId: user.id,
      },
    );
    return {
      user: sanitizeUser(user),
      message: 'Groomer registration submitted for admin approval.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { groomerProfile: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.password)))
      throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');
    if (user.role === 'BUYER' && !user.emailVerified)
      throw new ForbiddenException(
        'Buyer email verification is required before login',
      );
    if (
      user.role === 'GROOMER' &&
      user.groomerProfile?.approvalStatus !== 'APPROVED'
    )
      throw new ForbiddenException(
        'Admin approval is required before groomer login',
      );
    if (user.status !== 'ACTIVE')
      throw new ForbiddenException('Account is not active');
    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await this.hash(tokens.refreshToken) },
    });
    return { user: sanitizeUser(user), ...tokens };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user?.refreshTokenHash ||
      !(await bcrypt.compare(dto.refreshToken, user.refreshTokenHash))
    )
      throw new UnauthorizedException('Refresh token revoked');
    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await this.hash(tokens.refreshToken) },
    });
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await bcrypt.compare(dto.currentPassword, user.password)))
      throw new BadRequestException('Current password is incorrect');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await this.hash(dto.newPassword),
        refreshTokenHash: null,
      },
    });
    return { message: 'Password changed' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user)
      return { message: 'If the email exists, a reset token was generated.' };
    const token = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: await this.hash(token),
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return {
      message:
        'Password reset token generated. Wire this to email in production.',
      resetToken: token,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const users = await this.prisma.user.findMany({
      where: { passwordResetExpiresAt: { gt: new Date() } },
    });
    const user = users.find(
      (item) =>
        item.passwordResetTokenHash &&
        bcrypt.compareSync(dto.token, item.passwordResetTokenHash),
    );
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.hash(dto.newPassword),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
      },
    });
    return { message: 'Password reset complete' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email?.toLowerCase() || '' },
    });
    if (!user || user.role !== 'BUYER') {
      throw new BadRequestException(
        'Invalid buyer email verification request',
      );
    }
    if (!user.emailVerificationToken) {
      throw new BadRequestException('Email already verified');
    }
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Email verification OTP expired');
    }
    if (!(await bcrypt.compare(dto.otp, user.emailVerificationToken))) {
      throw new BadRequestException('Invalid email verification OTP');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { message: 'Email verified successfully' };
  }

  private async ensureEmailFree(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('Email already registered');
  }

  private async hash(value: string) {
    return bcrypt.hash(value, Number(this.config.get('BCRYPT_ROUNDS') ?? 12));
  }

  private generateOtp() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async signTokens(sub: string, email: string, role: string) {
    const payload = { sub, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '30d',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
