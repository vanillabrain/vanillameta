import multer from 'multer';
import { Utf8FileInterceptor } from '../database/multipart-options';

export const ARTIFACT_MULTIPART_OPTIONS = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 2, parts: 3, fieldSize: 1024 },
} as const;
export const ArtifactMultipartInterceptor = Utf8FileInterceptor('file', ARTIFACT_MULTIPART_OPTIONS);
