# Karoot Backend Technology Stack

## Programming Languages

- **TypeScript** — main backend language
- **JavaScript** — deployment and utility scripts
- **SQL** — PostgreSQL migrations

**Total: 3 languages**

## Backend

- **Node.js 22** — runtime
- **NestJS 11** — backend framework
- **Express** — HTTP server
- **REST API** — API architecture
- **Socket.IO** — real-time chat and notifications
- **Swagger / OpenAPI** — API documentation

## Database

- **PostgreSQL on AWS** — production database
- **Prisma ORM** — database access and migrations

## Deployment

- **Docker** — application container
- **Docker Compose** — container management
- **GitHub Actions** — automated deployment
- **Docker Hub** — container image storage
- **VPS** — production server

## Payment System

- **Stripe** — customer payments and refunds
- **Stripe Connect** — groomer onboarding and payouts

## File Storage

- **MinIO** — primary file and image storage
- **AWS S3 SDK** — connects the backend to MinIO

## Third-Party Services

| Service | Purpose |
| --- | --- |
| Stripe | Payments, refunds, and groomer payouts |
| MinIO | File and image storage |
| Cloudinary | Alternative media storage |
| Firebase Cloud Messaging | Mobile push notifications |
| SMTP / Nodemailer | Verification and password-reset emails |

## Security

- **JWT** — access and refresh authentication
- **bcrypt** — password hashing
- **Helmet** — HTTP security headers

## Testing and Code Quality

- **Jest** and **Supertest** — testing
- **ESLint** — code checking
- **Prettier** — code formatting
