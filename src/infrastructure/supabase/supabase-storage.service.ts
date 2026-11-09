import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { SupabaseService } from './supabase.service';

/** Thin wrapper over Supabase Storage using a single private bucket. */
@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;
  private bucketReady = false;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.bucket = config.get('supabase', { infer: true }).storageBucket;
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const storage = this.supabase.admin.storage;
    const { data } = await storage.getBucket(this.bucket);
    if (!data) {
      const { error } = await storage.createBucket(this.bucket, { public: false });
      if (error && !/already exists/i.test(error.message)) {
        this.logger.error(`Cannot create bucket "${this.bucket}": ${error.message}`);
        throw new InternalServerErrorException('File storage is unavailable');
      }
    }
    this.bucketReady = true;
  }

  async upload(path: string, body: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    const { error } = await this.supabase.admin.storage
      .from(this.bucket)
      .upload(path, body, { contentType, upsert: true });
    if (error) {
      this.logger.error(`Upload failed for ${path}: ${error.message}`);
      throw new InternalServerErrorException('File upload failed');
    }
    return path;
  }

  async signedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
    const { data, error } = await this.supabase.admin.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error) {
      this.logger.warn(`Cannot sign ${path}: ${error.message}`);
      return null;
    }
    return data.signedUrl;
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.supabase.admin.storage.from(this.bucket).remove([path]);
    if (error) this.logger.warn(`Cannot remove ${path}: ${error.message}`);
  }
}
