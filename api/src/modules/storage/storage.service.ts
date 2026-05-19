import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EnvironmentVariables } from '../../config/env.validation';

const DEFAULT_S3_REGION = 'us-east-1';
const PRESIGN_UPLOAD_TTL_SECONDS = 15 * 60;
const PRESIGN_DOWNLOAD_TTL_SECONDS = 60 * 60;

/**
 * Two S3 clients live here:
 *   - `internal` uses S3_ENDPOINT (resolved within the container network, e.g. http://minio:9000).
 *     Used for HEAD / GET / DELETE operations performed by the server itself.
 *   - `public` uses S3_PUBLIC_ENDPOINT (browser-reachable, e.g. http://localhost:9000).
 *     Used only when *signing* URLs that the browser will follow.
 *
 * In production where MinIO/S3 is reachable at one address, both clients can have the same endpoint.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private internalClient!: S3Client;
  private publicClient!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit(): void {
    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const publicEndpoint = this.config.get('S3_PUBLIC_ENDPOINT', { infer: true }) ?? endpoint;
    const accessKeyId = this.config.get('S3_ACCESS_KEY', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_KEY', { infer: true });
    const region = this.config.get('S3_REGION', { infer: true }) ?? DEFAULT_S3_REGION;
    this.bucket = this.config.get('S3_BUCKET', { infer: true });

    const sharedOptions = {
      region,
      credentials: { accessKeyId, secretAccessKey },
      // MinIO requires path-style addressing
      forcePathStyle: true,
    };

    this.internalClient = new S3Client({ ...sharedOptions, endpoint });
    this.publicClient = new S3Client({ ...sharedOptions, endpoint: publicEndpoint });

    this.logger.log(
      `S3 storage initialized: bucket=${this.bucket}, internal=${endpoint}, public=${publicEndpoint}`,
    );
  }

  buildStorageKey(teamId: string, attachmentId: string, filename: string): string {
    // Keep the original filename for content-disposition heuristics, but
    // prefix with a UUID so collisions can't happen.
    const safe = filename.replace(/[^\w.\-]+/g, '_').slice(0, 200);
    return `teams/${teamId}/attachments/${attachmentId}/${safe}`;
  }

  /** Browser-targeted PUT URL with size + content-type constraints. */
  async presignUpload(params: {
    storageKey: string;
    contentType: string;
    contentLength: number;
  }): Promise<{ url: string; expiresAt: Date }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: PRESIGN_UPLOAD_TTL_SECONDS,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + PRESIGN_UPLOAD_TTL_SECONDS * 1000),
    };
  }

  /** Browser-targeted GET URL for downloading the file. */
  async presignDownload(params: {
    storageKey: string;
    filename: string;
  }): Promise<{ url: string; expiresAt: Date }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(params.filename)}"`,
    });
    const url = await getSignedUrl(this.publicClient, command, {
      expiresIn: PRESIGN_DOWNLOAD_TTL_SECONDS,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + PRESIGN_DOWNLOAD_TTL_SECONDS * 1000),
    };
  }

  /** Server-side check that the object exists. */
  async headObject(storageKey: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const result = await this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch (err) {
      const code = (err as { name?: string }).name;
      if (code === 'NotFound' || code === 'NoSuchKey') return null;
      throw err;
    }
  }

  /** Server-side hard delete. */
  async deleteObject(storageKey: string): Promise<void> {
    await this.internalClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
