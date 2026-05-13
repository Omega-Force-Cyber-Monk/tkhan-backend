import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);
  private readonly app?: admin.app.App;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return;
    }

    this.app =
      admin.apps.length > 0
        ? admin.app()
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
  }

  get enabled() {
    return Boolean(this.app);
  }

  async sendToTokens(
    tokens: string[],
    notification: { title: string; body?: string },
    data?: Record<string, any>,
  ) {
    if (!this.app || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const normalizedData = Object.fromEntries(
      Object.entries(data ?? {}).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]),
    );

    try {
      return await admin.messaging(this.app).sendEachForMulticast({
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: normalizedData,
      });
    } catch (error) {
      this.logger.warn(
        `Firebase push failed: ${error instanceof Error ? error.message : error}`,
      );
      return { successCount: 0, failureCount: tokens.length, responses: [] };
    }
  }
}
