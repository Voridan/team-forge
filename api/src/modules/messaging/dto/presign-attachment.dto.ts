import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB hard cap

export class PresignAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType must be a valid MIME type' })
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_BYTES, { message: `sizeBytes must be at most ${MAX_FILE_BYTES} bytes (25 MB)` })
  sizeBytes!: number;
}
