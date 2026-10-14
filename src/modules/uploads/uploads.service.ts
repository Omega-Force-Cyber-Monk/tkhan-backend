import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { extname } from 'path';

type UploadProvider = 'minio' | 'cloudinary';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File | undefined, folder: string) {
    if (!file) return undefined;
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (this.uploadProvider() === 'minio') {
      return this.uploadToMinio(file, folder);
    }

    this.ensureCloudinaryConfigured();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, uploadResult) => {
          if (error || !uploadResult) return reject(error);
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    });

    return result.secure_url;
  }

  async uploadFile(file: Express.Multer.File | undefined, folder: string) {
    if (!file) return undefined;
    if (this.uploadProvider() === 'minio') {
      return this.uploadToMinio(file, folder);
    }

    this.ensureCloudinaryConfigured();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, uploadResult) => {
          if (error || !uploadResult) return reject(error);
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    });

    return result.secure_url;
  }

  private uploadProvider(): UploadProvider {
    const configuredProvider = this.config
      .get<string>('UPLOAD_STORAGE')
      ?.trim()
      .toLowerCase();
    if (configuredProvider === 'minio' || configuredProvider === 'cloudinary') {
      return configuredProvider;
    }
    return this.config.get<string>('MINIO_ENDPOINT') ? 'minio' : 'cloudinary';
  }

  private async uploadToMinio(file: Express.Multer.File, folder: string) {
    const config = this.minioConfig();
    const objectKey = this.buildObjectKey(folder, file.originalname);

    try {
      const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey,
        },
      });

      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype || 'application/octet-stream',
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `MinIO upload failed: ${message}`,
      );
    }

    const publicBaseUrl =
      config.publicBaseUrl || `${config.endpoint}/${config.bucket}`;
    return `${publicBaseUrl.replace(/\/+$/, '')}/${this.encodeObjectKey(objectKey)}`;
  }

  private minioConfig() {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT')?.trim();
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY')?.trim();
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');
    const bucket =
      this.config.get<string>('MINIO_BUCKET')?.trim() || 'karoot';
    const region =
      this.config.get<string>('MINIO_REGION')?.trim() || 'us-east-1';
    const publicBaseUrl = this.config
      .get<string>('MINIO_PUBLIC_BASE_URL')
      ?.trim();

    if (!endpoint || !accessKey || !secretKey) {
      throw new InternalServerErrorException(
        'MinIO credentials are not configured',
      );
    }

    return {
      endpoint: endpoint.replace(/\/+$/, ''),
      accessKey,
      secretKey,
      bucket,
      region,
      publicBaseUrl,
    };
  }

  private buildObjectKey(folder: string, originalName?: string) {
    const safeFolder = folder
      .split('/')
      .map((part) => part.trim().replace(/[^a-zA-Z0-9._-]/g, '-'))
      .filter(Boolean)
      .join('/');
    const extension = this.safeExtension(originalName);
    return `${safeFolder}/${Date.now()}-${randomUUID()}${extension}`;
  }

  private safeExtension(originalName?: string) {
    const extension = extname(originalName || '').toLowerCase();
    return /^[a-z0-9.]{1,12}$/.test(extension) ? extension : '';
  }

  private encodeObjectKey(key: string) {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private ensureCloudinaryConfigured() {
    if (
      !this.config.get<string>('CLOUDINARY_CLOUD_NAME') ||
      !this.config.get<string>('CLOUDINARY_API_KEY') ||
      !this.config.get<string>('CLOUDINARY_API_SECRET')
    ) {
      throw new InternalServerErrorException(
        'Cloudinary credentials are not configured',
      );
    }
  }
}
