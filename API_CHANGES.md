# API Changes Quick Reference

## New Endpoints

### Booking Images Upload
**Endpoint:** `PATCH /api/v1/bookings/:id/images`  
**Authentication:** Required (Bearer token)  
**Role:** GROOMER  
**Status Code:** 200 OK  

**Request Body:**
```json
{
  "beforeImage": "https://cdn.example.com/before.jpg",
  "afterImage": "https://cdn.example.com/after.jpg"
}
```

**Notes:**
- At least one of `beforeImage` or `afterImage` must be provided
- Booking must be in `IN_PROGRESS` status
- Only the assigned groomer can upload images
- Images are optional fields (can update just one)

**Response:**
```json
{
  "id": "booking-uuid",
  "bookingNumber": "BK-1234567890",
  "status": "IN_PROGRESS",
  "beforeImage": "https://cdn.example.com/before.jpg",
  "afterImage": "https://cdn.example.com/after.jpg",
  "buyerId": "buyer-uuid",
  "groomerId": "groomer-uuid",
  "petId": "pet-uuid",
  "updatedAt": "2026-05-05T10:30:00.000Z"
}
```

---

## Updated Endpoints

### Buyer Registration (Email Verification Enhanced)
**Endpoint:** `POST /api/v1/auth/register/buyer`  
**Authentication:** None (Public)  
**Status Code:** 201 Created  

**Request Body:**
```json
{
  "fullName": "Ava Khan",
  "phone": "+15551234567",
  "email": "buyer@example.com",
  "password": "securePassword123",
  "locationText": "Austin, TX",
  "state": "TX"
}
```

**Response (NEW):**
```json
{
  "user": {
    "id": "buyer-uuid",
    "fullName": "Ava Khan",
    "email": "buyer@example.com",
    "phone": "+15551234567",
    "role": "BUYER",
    "status": "PENDING_EMAIL_VERIFICATION",
    "emailVerified": false,
    "locationText": "Austin, TX",
    "state": "TX",
    "createdAt": "2026-05-05T10:00:00.000Z"
  },
  "message": "Buyer registered. Verify email before using protected buyer flows.",
  "emailVerificationToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Changes:**
- Now returns `emailVerificationToken` (for development/testing)
- Token expires in 24 hours
- Token must be used for email verification

---

### Email Verification (Enhanced)
**Endpoint:** `POST /api/v1/auth/verify-email`  
**Authentication:** None (Public)  
**Status Code:** 200 OK  

**Request Body (UPDATED):**
```json
{
  "email": "buyer@example.com",
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response:**
```json
{
  "message": "Email verified successfully"
}
```

**Changes:**
- Now requires both `email` and `token` (previously only email)
- Token is validated and verified before marking email as verified
- Token must be valid and not expired (24 hours)
- After verification, user can login

**Error Responses:**
```json
// Invalid or missing email
{ "error": "Invalid email verification request" }

// Already verified
{ "error": "Email already verified" }

// Token expired
{ "error": "Email verification token expired" }

// Invalid token
{ "error": "Invalid email verification token" }
```

---

### Groomer Registration (Selfie Field Added)
**Endpoint:** `POST /api/v1/auth/register/groomer`  
**Authentication:** None (Public)  
**Status Code:** 201 Created  

**Request Body (UPDATED):**
```json
{
  "fullName": "Ava Khan",
  "phone": "+15551234567",
  "email": "groomer@example.com",
  "password": "securePassword123",
  "locationText": "Austin, TX",
  "state": "TX",
  "experienceYears": 5,
  "legalFullName": "Ava Noor Khan",
  "idNumber": "P1234567",
  "idType": "PASSPORT",
  "businessName": "Ava Mobile Grooming",
  "serviceArea": "Austin metro",
  "businessAddress": "120 Market Street, Austin, TX",
  "idFrontImage": "https://cdn.example.com/id-front.jpg",
  "idBackImage": "https://cdn.example.com/id-back.jpg",
  "selfieWithId": "https://cdn.example.com/selfie-with-id.jpg"
}
```

**Response:**
```json
{
  "user": {
    "id": "groomer-uuid",
    "fullName": "Ava Khan",
    "email": "groomer@example.com",
    "role": "GROOMER",
    "status": "INACTIVE",
    "createdAt": "2026-05-05T10:00:00.000Z"
  },
  "message": "Groomer registration submitted for admin approval."
}
```

**Notes:**
- `selfieWithId` is **optional** - can be added now or later via profile update
- Required status for groomer: `INACTIVE` (needs admin approval)
- Cannot login until admin approves registration

---

### Groomer Profile Update (Selfie Field Added)
**Endpoint:** `PATCH /api/v1/groomer/profile`  
**Authentication:** Required (Bearer token)  
**Role:** GROOMER  
**Status Code:** 200 OK  

**Request Body (UPDATED):**
```json
{
  "fullName": "Ava Khan",
  "phone": "+15551234567",
  "profileImage": "https://cdn.example.com/profile.jpg",
  "selfieWithId": "https://cdn.example.com/selfie-with-id.jpg",
  "shortBio": "Professional groomer with 5+ years experience",
  "about": "I specialize in dog grooming...",
  "certifications": ["cert1", "cert2"],
  "availableForBookings": true
}
```

**Response:**
```json
{
  "id": "profile-uuid",
  "userId": "groomer-uuid",
  "experienceYears": 5,
  "legalFullName": "Ava Noor Khan",
  "idNumber": "P1234567",
  "idType": "PASSPORT",
  "businessName": "Ava Mobile Grooming",
  "serviceArea": "Austin metro",
  "businessAddress": "120 Market Street, Austin, TX",
  "idFrontImage": "https://cdn.example.com/id-front.jpg",
  "idBackImage": "https://cdn.example.com/id-back.jpg",
  "selfieWithId": "https://cdn.example.com/selfie-with-id.jpg",
  "shortBio": "Professional groomer with 5+ years experience",
  "about": "I specialize in dog grooming...",
  "certifications": ["cert1", "cert2"],
  "availableForBookings": true,
  "approvalStatus": "PENDING",
  "createdAt": "2026-05-05T10:00:00.000Z",
  "updatedAt": "2026-05-05T10:30:00.000Z"
}
```

**Notes:**
- All fields are optional
- `selfieWithId` can be added, updated, or removed
- Update is only available for authenticated groomers

---

## Unchanged Endpoints

All existing endpoints remain unchanged and fully backward compatible:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/bookings`
- `GET /api/v1/bookings/:id`
- `POST /api/v1/bookings`
- `PATCH /api/v1/bookings/:id/accept`
- `PATCH /api/v1/bookings/:id/reject`
- `PATCH /api/v1/bookings/:id/request-completion`
- `PATCH /api/v1/bookings/:id/approve-completion`
- All groomer, availability, and other endpoints

---

## Migration Instructions

### Step 1: Apply Database Migration
```bash
npx prisma migrate deploy
```

### Step 2: Regenerate Prisma Client (if needed)
```bash
npx prisma generate
```

### Step 3: Deploy New Code
```bash
npm run build
npm start
```

---

## Integration Notes

### Email Verification in Production
1. Remove `emailVerificationToken` from registration response
2. Integrate email service to send verification token
3. User receives token via email
4. User clicks link or manually enters token in app
5. Calls `POST /api/v1/auth/verify-email` with token
6. Account is activated

### Image Upload Integration
Images are currently handled as URL strings. To integrate with cloud storage:
1. Implement file upload handler (multipart/form-data)
2. Upload to S3/GCS/Azure
3. Return signed URL
4. Send URL to booking images endpoint

---

## Error Handling

All endpoints follow the project's error handling pattern:

**400 Bad Request** - Invalid input
```json
{ "error": "At least one image must be provided" }
```

**401 Unauthorized** - Missing or invalid token
```json
{ "error": "Unauthorized" }
```

**403 Forbidden** - Insufficient permissions
```json
{ "error": "Booking belongs to another groomer" }
```

**404 Not Found** - Resource not found
```json
{ "error": "Not found" }
```

**500 Internal Server Error** - Server error
```json
{ "error": "Internal server error" }
```

---

## Testing Examples

### Test Email Verification Flow
```bash
# 1. Register buyer
curl -X POST http://localhost:3000/api/v1/auth/register/buyer \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Buyer",
    "email": "test@example.com",
    "password": "Password123",
    "phone": "+1234567890",
    "locationText": "Test City",
    "state": "TS"
  }'

# Response includes emailVerificationToken

# 2. Verify email with token
curl -X POST http://localhost:3000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "token": "TOKEN_FROM_RESPONSE"
  }'

# 3. Login (now allowed)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

### Test Booking Images Upload
```bash
# Upload before/after images
curl -X PATCH http://localhost:3000/api/v1/bookings/BOOKING_ID/images \
  -H "Authorization: Bearer GROOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "beforeImage": "https://cdn.example.com/before.jpg",
    "afterImage": "https://cdn.example.com/after.jpg"
  }'
```

---

## Swagger Documentation

All new endpoints and updated DTOs include full Swagger documentation:
- Clear descriptions of each field
- Example values for testing
- Response schemas
- Error responses

Access Swagger UI at: `http://localhost:3000/api/docs`
