import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { renderNotificationTemplate } from '../notifications/notification-templates';
import { CreateReviewDto } from './dto/reviews.dto';
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
  async create(userId: string, role: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: dto.bookingId },
      include: {
        buyer: { select: { fullName: true } },
        groomer: { select: { fullName: true } },
      },
    });
    if (booking.status !== 'COMPLETED')
      throw new BadRequestException('Booking must be completed before review');
    const reviewerIsBuyer =
      booking.buyerId === userId && dto.targetType === 'GROOMER';
    const reviewerIsGroomer =
      booking.groomerId === userId && dto.targetType === 'BUYER';
    if (!reviewerIsBuyer && !reviewerIsGroomer)
      throw new ForbiddenException('Invalid review direction for this booking');
    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        reviewerId: userId,
        revieweeId: reviewerIsBuyer ? booking.groomerId : booking.buyerId,
        targetType: dto.targetType,
        rating: dto.rating,
        feedback: dto.feedback,
      },
    });
    const notification = renderNotificationTemplate(
      reviewerIsBuyer ? 'GROOMER_NEW_REVIEW' : 'BUYER_NEW_REVIEW',
      {
        CustomerName: booking.buyer.fullName,
        GroomerName: booking.groomer.fullName,
      },
    );
    await this.notifications.create(
      review.revieweeId,
      'REVIEW_CREATED',
      notification.title,
      notification.body,
      {
        targetScreen: 'reviews',
        bookingId: booking.id,
        reviewId: review.id,
      },
    );
    return review;
  }
  forUser(userId: string) {
    return this.prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: 'desc' },
      include: { reviewer: true },
    });
  }
}
