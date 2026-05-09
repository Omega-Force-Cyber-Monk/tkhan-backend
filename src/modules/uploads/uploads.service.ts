import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

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
    this.ensureConfigured();

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
    this.ensureConfigured();

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

  private ensureConfigured() {
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
