import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/reviews.dto';
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, role: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: dto.bookingId },
    });
    if (booking.status !== 'COMPLETED')
      throw new BadRequestException('Booking must be completed before review');
    const reviewerIsBuyer =
      booking.buyerId === userId && dto.targetType === 'GROOMER';
    const reviewerIsGroomer =
      booking.groomerId === userId && dto.targetType === 'BUYER';
    if (!reviewerIsBuyer && !reviewerIsGroomer)
      throw new ForbiddenException('Invalid review direction for this booking');
    return this.prisma.review.create({
      data: {
        bookingId: booking.id,
        reviewerId: userId,
        revieweeId: reviewerIsBuyer ? booking.groomerId : booking.buyerId,
        targetType: dto.targetType,
        rating: dto.rating,
        feedback: dto.feedback,
      },
    });
  }
  forUser(userId: string) {
    return this.prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: 'desc' },
      include: { reviewer: true },
    });
  }
}
