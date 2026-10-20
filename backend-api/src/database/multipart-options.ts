import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  mixin,
  NestInterceptor,
  Optional,
  PayloadTooLargeException,
  Type,
} from '@nestjs/common';
import multer from 'multer';

/** Browser filename headers are UTF-8; explicit filename* charsets remain authoritative. */
export const UTF8_MULTIPART_OPTIONS = { defParamCharset: 'utf8' } as const;

/** Use the app's Multer 2.x. Nest 9's nested Multer 1.x ignores defParamCharset. */
export function Utf8FileInterceptor(
  fieldName: string,
  localOptions: multer.Options = {},
): Type<NestInterceptor> {
  class UploadInterceptor implements NestInterceptor {
    private readonly upload: ReturnType<typeof multer>;
    constructor(@Optional() @Inject('MULTER_MODULE_OPTIONS') options: multer.Options = {}) {
      this.upload = multer({ ...options, ...localOptions, ...UTF8_MULTIPART_OPTIONS });
    }
    async intercept(context: ExecutionContext, next: CallHandler) {
      const http = context.switchToHttp();
      await new Promise<void>((resolve, reject) => {
        this.upload.single(fieldName)(http.getRequest(), http.getResponse(), error => {
          if (!error) return resolve();
          if (error instanceof multer.MulterError) {
            return reject(
              error.code === 'LIMIT_FILE_SIZE'
                ? new PayloadTooLargeException(error.message)
                : new BadRequestException(error.message),
            );
          }
          if (
            /^Multipart: Boundary not found$|^Malformed part header$|^Unexpected end of (form|file)$/.test(
              error.message,
            )
          )
            return reject(new BadRequestException(error.message));
          // Storage/I/O errors retain their server failure semantics.
          reject(error);
        });
      });
      return next.handle();
    }
  }
  return mixin(UploadInterceptor);
}
