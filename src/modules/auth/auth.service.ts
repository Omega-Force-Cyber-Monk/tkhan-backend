import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { sanitizeUser } from '../../common/utils/sanitize-user';
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
  ) {}

  async registerBuyer(dto: RegisterBuyerDto) {
    await this.ensureEmailFree(dto.email);
    const password = await this.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email.toLowerCase(),
        password,
        locationText: dto.locationText,
        state: dto.state,
        role: 'BUYER',
        status: 'PENDING_EMAIL_VERIFICATION',
        buyerProfile: { create: {} },
      },
      include: { buyerProfile: true },
    });
    return {
      user: sanitizeUser(user),
      message:
        'Buyer registered. Verify email before using protected buyer flows.',
    };
  }

  async registerGroomer(dto: RegisterGroomerDto) {
    await this.ensureEmailFree(dto.email);
    const password = await this.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email.toLowerCase(),
        password,
        locationText: dto.locationText,
        state: dto.state,
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
            idFrontImage: dto.idFrontImage,
            idBackImage: dto.idBackImage,
            approvalStatus: 'PENDING',
          },
        },
      },
      include: { groomerProfile: true },
    });
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
      throw new ForbiddenException('Email verification required');
    if (
      user.role === 'GROOMER' &&
      user.groomerProfile?.approvalStatus !== 'APPROVED'
    )
      throw new ForbiddenException('Groomer approval required before login');
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
    // Token storage for email verification should be swapped to a dedicated token table when email delivery is enabled.
    const user = dto.email
      ? await this.prisma.user.findUnique({
          where: { email: dto.email.toLowerCase() },
        })
      : null;
    if (!user || user.role !== 'BUYER')
      throw new BadRequestException('Invalid email verification request');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, status: 'ACTIVE' },
    });
    return { message: 'Email verified' };
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

  private async signTokens(sub: string, email: string, role: string) {
    const payload = { sub, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
