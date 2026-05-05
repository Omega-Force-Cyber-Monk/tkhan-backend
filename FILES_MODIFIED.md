# Files Modified - Quick Reference

## Database & Migrations

### [prisma/schema.prisma](prisma/schema.prisma)
**Lines Modified:** 
- Added `beforeImage: String?` and `afterImage: String?` to Booking model (after completionNote)
- Added `emailVerificationToken: String?` and `emailVerificationExpiresAt: DateTime?` to User model (after emailVerified)
- Added `selfieWithId: String?` to GroomerProfile model (after idBackImage)

**Total Schema Additions:** 5 new fields

### [prisma/migrations/20260505000000_add_booking_images_and_selfie/migration.sql](prisma/migrations/20260505000000_add_booking_images_and_selfie/migration.sql)
**New File** - Database migration with 3 ALTER TABLE statements:
- Add beforeImage and afterImage to Booking table
- Add selfieWithId to GroomerProfile table  
- Add emailVerificationToken and emailVerificationExpiresAt to User table

---

## Authentication Module

### [src/modules/auth/dto/auth.dto.ts](src/modules/auth/dto/auth.dto.ts)
**Changes:**
- Added optional `selfieWithId` field to `RegisterGroomerDto` class
- Includes Swagger documentation and validation decorator

### [src/modules/auth/auth.service.ts](src/modules/auth/auth.service.ts)
**Changes:**

1. **registerBuyer() method:**
   - Added import of `randomBytes` from crypto
   - Generates `emailVerificationToken` (32 random bytes)
   - Sets `emailVerificationExpiresAt` to 24 hours from now
   - Hashes token using `this.hash()`
   - Stores hashed token and expiration in user creation
   - Returns plain token in response

2. **registerGroomer() method:**
   - Added `selfieWithId: dto.selfieWithId` to groomerProfile creation

3. **verifyEmail() method:**
   - Complete rewrite with proper token validation
   - Checks email exists and is BUYER role
   - Validates token hasn't expired
   - Compares provided token against stored hash using bcrypt
   - Clears token and expiration on success
   - Proper error messages for each failure case

---

## Groomer Module

### [src/modules/groomer/dto/groomer.dto.ts](src/modules/groomer/dto/groomer.dto.ts)
**Changes:**
- Added optional `selfieWithId` field to `UpdateGroomerProfileDto` class
- Includes Swagger documentation and validation decorator

### [src/modules/groomer/groomer.service.ts](src/modules/groomer/groomer.service.ts)
**No Changes Required**
- Existing `updateProfile()` method already supports all new optional fields via destructuring

---

## Bookings Module

### [src/modules/bookings/dto/bookings.dto.ts](src/modules/bookings/dto/bookings.dto.ts)
**Changes:**
- Added new `UploadBookingImagesDto` class with:
  - Optional `beforeImage: string` field
  - Optional `afterImage: string` field
  - Swagger documentation for both fields

### [src/modules/bookings/bookings.service.ts](src/modules/bookings/bookings.service.ts)
**Changes:**
- Added import of `UploadBookingImagesDto`
- Added new `uploadImages()` method:
  - Validates booking exists
  - Ensures booking is in IN_PROGRESS status
  - Verifies groomer ownership
  - Validates at least one image provided
  - Updates and returns booking

### [src/modules/bookings/bookings.controller.ts](src/modules/bookings/bookings.controller.ts)
**Changes:**
- Added import of `UploadBookingImagesDto`
- Added new endpoint handler:
  - `PATCH /bookings/:id/images`
  - `@Roles('GROOMER')` decorator
  - Uses `uploadImages()` service method

---

## Summary of Changes

| File | Type | Changes | Status |
|------|------|---------|--------|
| prisma/schema.prisma | Schema | +5 fields | ✓ Updated |
| prisma/migrations/.../migration.sql | Migration | New file | ✓ Created |
| src/modules/auth/dto/auth.dto.ts | DTO | +1 field | ✓ Updated |
| src/modules/auth/auth.service.ts | Service | +2 methods, 1 enhancement | ✓ Updated |
| src/modules/groomer/dto/groomer.dto.ts | DTO | +1 field | ✓ Updated |
| src/modules/groomer/groomer.service.ts | Service | No changes needed | ✓ OK |
| src/modules/bookings/dto/bookings.dto.ts | DTO | +1 new class | ✓ Updated |
| src/modules/bookings/bookings.service.ts | Service | +1 method | ✓ Updated |
| src/modules/bookings/bookings.controller.ts | Controller | +1 endpoint | ✓ Updated |

**Total Files Modified:** 8  
**Total Files Created:** 2 (migration + 2 documentation files)

---

## Key Design Decisions

1. **Email Verification Token**
   - Generated on registration (not on-demand)
   - Hashed using bcrypt (same as password)
   - 24-hour expiration
   - Token returned in response for dev/testing
   - Ready for email service integration

2. **Before/After Images**
   - Stored as URL strings (consistent with existing image fields)
   - Both optional, at least one required on upload
   - Only uploadable when booking is IN_PROGRESS
   - Authorization checked at service and controller level

3. **Selfie with ID**
   - Optional field at registration (can be added later)
   - Updateable via profile endpoint
   - No special validation (relies on external image validation)

4. **No Breaking Changes**
   - All new fields are optional
   - All new endpoints are additions (no modifications to existing)
   - Backward compatible with existing clients

---

## Build & Compilation Status

✓ TypeScript compilation: SUCCESS  
✓ Prisma client generation: SUCCESS  
✓ No new linting errors introduced  
✓ Code follows existing conventions  
✓ All DTOs properly validated  

---

## Testing Recommendations

1. **Email Verification Flow**
   - Register buyer -> Get token -> Verify email -> Login

2. **Booking Images**
   - Create booking -> Set to IN_PROGRESS -> Upload images -> Verify in response

3. **Groomer Registration**
   - Register with selfieWithId -> Verify in profile -> Update selfieWithId

4. **Error Cases**
   - Upload images when booking not IN_PROGRESS
   - Groomer tries to upload images for another groomer's booking
   - Invalid/expired email verification token
   - Missing required fields in DTO validation

---

## Production Deployment

**Order of steps:**
1. Review this documentation
2. Deploy code changes
3. Run database migration: `npx prisma migrate deploy`
4. Verify migration success
5. Restart application
6. Test endpoints with documentation
7. Monitor logs for any issues

**No environment variables required for these changes.**

**Optional future integration:**
- Email service for automated verification
- Cloud storage for images
- Admin interface for document review
