import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import {
  BookingDecisionDto,
  BookingQueryDto,
  CompletionRequestDto,
  CreateBookingDto,
  UploadBookingImagesDto,
} from './dto/bookings.dto';
import { BookingsService } from './bookings.service';

const bookingExample = {
  id: 'booking-uuid',
  bookingNumber: 'BK-1770000000000',
  buyerId: 'buyer-user-uuid',
  groomerId: 'groomer-user-uuid',
  petId: 'pet-uuid',
  availabilitySlotId: 'slot-uuid',
  serviceLocation: 'Customer home',
  addressLine: '120 Market Street',
  state: 'TX',
  city: 'Austin',
  postalCode: '78701',
  note: 'Please use hypoallergenic shampoo.',
  status: 'PAYMENT_PENDING',
  subtotalAmount: '75.00',
  platformFeeAmount: '7.50',
  groomerEarningAmount: '67.50',
  totalAmount: '75.00',
  requestedAt: null,
  acceptedAt: null,
  rejectedAt: null,
  cancelledAt: null,
  inProgressAt: null,
  completionRequestedAt: null,
  completedAt: null,
  refundedAt: null,
  rejectionReason: null,
  cancellationReason: null,
  completionNote: null,
  beforeImage: null,
  afterImage: null,
  createdAt: '2026-05-11T04:30:00.000Z',
  updatedAt: '2026-05-11T04:30:00.000Z',
  services: [
    {
      id: 'booking-service-uuid',
      bookingId: 'booking-uuid',
      serviceId: 'service-uuid',
      serviceTitle: 'Full Grooming',
      serviceDescription: 'Bath, haircut, nail trim and brushing.',
      durationMinutes: 90,
      price: '75.00',
      categoryName: 'Dog Grooming',
      createdAt: '2026-05-11T04:30:00.000Z',
    },
  ],
  addons: [
    {
      id: 'booking-addon-uuid',
      bookingId: 'booking-uuid',
      addonId: 'addon-uuid',
      addonTitle: 'Teeth Brushing',
      addonDescription: 'Gentle dental care add-on.',
      durationMinutes: 10,
      price: '10.00',
      createdAt: '2026-05-11T04:30:00.000Z',
    },
  ],
  pet: {
    id: 'pet-uuid',
    buyerId: 'buyer-user-uuid',
    name: 'Milo',
    breed: 'Golden Retriever',
    age: 3,
    temperament: 'Friendly',
    petType: 'DOG',
    petSize: 'LARGE',
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-10T10:00:00.000Z',
  },
  buyer: {
    id: 'buyer-user-uuid',
    fullName: 'Amit Khan',
    email: 'buyer@example.com',
    phone: '+15551234567',
    profileImage: 'https://res.cloudinary.com/demo/image/upload/buyer.jpg',
    locationText: 'Austin, TX',
    state: 'TX',
    role: 'BUYER',
    status: 'ACTIVE',
    createdAt: '2026-05-10T09:00:00.000Z',
    updatedAt: '2026-05-10T09:00:00.000Z',
  },
  groomer: {
    id: 'groomer-user-uuid',
    fullName: 'Sarah Groomer',
    email: 'groomer@example.com',
    phone: '+15559876543',
    profileImage: 'https://res.cloudinary.com/demo/image/upload/groomer.jpg',
    locationText: 'Austin, TX',
    state: 'TX',
    role: 'GROOMER',
    status: 'ACTIVE',
    createdAt: '2026-05-09T09:00:00.000Z',
    updatedAt: '2026-05-09T09:00:00.000Z',
    groomerProfile: {
      id: 'groomer-profile-uuid',
      businessName: 'Sarah Pet Spa',
      serviceArea: 'Austin',
      businessAddress: '44 Grooming Lane',
      experienceYears: 5,
      shortBio: 'Gentle grooming for dogs and cats.',
      about: 'Certified groomer with in-home grooming experience.',
      certifications: [],
      serviceModes: ['IN_HOME'],
      availableForBookings: true,
      approvalStatus: 'APPROVED',
    },
  },
};

const createdBookingExample = {
  ...bookingExample,
  pet: undefined,
  buyer: undefined,
  groomer: undefined,
};
delete createdBookingExample.pet;
delete createdBookingExample.buyer;
delete createdBookingExample.groomer;

const bookingDetailExample = {
  ...bookingExample,
  earnings: {
    subtotalAmount: '75.00',
    platformFeeAmount: '7.50',
    groomerEarningAmount: '67.50',
    totalAmount: '75.00',
    payoutId: 'payout-uuid',
    payoutStatus: 'PENDING',
    payoutReleasedAt: null,
  },
};

const bookingListResponseExample = {
  success: true,
  data: {
    items: [bookingExample],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  },
};

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly uploads: UploadsService,
  ) {}
  @Roles('BUYER')
  @Post()
  @ApiCreatedResponse({
    description: 'Booking created successfully.',
    schema: {
      example: {
        success: true,
        data: createdBookingExample,
      },
    },
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.sub, dto);
  }
  @Get()
  @ApiOkResponse({
    description: 'Paginated booking list for the current user.',
    schema: {
      example: bookingListResponseExample,
      examples: {
        default: {
          summary: 'Demo response',
          value: bookingListResponseExample,
        },
      },
    },
  })
  list(@CurrentUser() user: AuthUser, @Query() dto: BookingQueryDto) {
    return this.bookingsService.listForUser(user.sub, user.role, dto);
  }
  @Get(':id')
  @ApiOkResponse({
    description: 'Booking detail with earnings data.',
    schema: {
      example: {
        success: true,
        data: bookingDetailExample,
      },
    },
  })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingsService.detail(user.sub, user.role, id);
  }
  @Roles('GROOMER') @Patch(':id/accept') accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bookingsService.accept(user.sub, id);
  }
  @Roles('GROOMER') @Patch(':id/reject') reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BookingDecisionDto,
  ) {
    return this.bookingsService.reject(user.sub, id, dto);
  }
  @Roles('GROOMER') @Patch(':id/request-completion') requestCompletion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompletionRequestDto,
  ) {
    return this.bookingsService.requestCompletion(user.sub, id, dto);
  }
  @Roles('BUYER') @Patch(':id/approve-completion') approveCompletion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bookingsService.approveCompletion(user.sub, id);
  }
  @Roles('GROOMER')
  @Patch(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        beforeImage: { type: 'string', format: 'binary' },
        afterImage: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'beforeImage', maxCount: 1 },
      { name: 'afterImage', maxCount: 1 },
    ]),
  )
  async uploadImages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadBookingImagesDto,
    @UploadedFiles()
    files?: {
      beforeImage?: Express.Multer.File[];
      afterImage?: Express.Multer.File[];
    },
  ) {
    dto.beforeImage = await this.uploads.uploadImage(
      files?.beforeImage?.[0],
      'tkhan/bookings',
    );
    dto.afterImage = await this.uploads.uploadImage(
      files?.afterImage?.[0],
      'tkhan/bookings',
    );
    return this.bookingsService.uploadImages(user.sub, id, dto);
  }
}
