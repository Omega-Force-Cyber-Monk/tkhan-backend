import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';
@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, user.role, dto);
  }
  @Get('users/:userId') forUser(@Param('userId') userId: string) {
    return this.reviewsService.forUser(userId);
  }
}
