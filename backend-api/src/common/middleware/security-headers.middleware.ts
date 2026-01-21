import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Content Security Policy - XSS 방지
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.*.amazonaws.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
    );

    // X-Frame-Options - 클릭재킹 방지
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options - MIME 타입 스니핑 방지
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Strict-Transport-Security - HTTPS 강제
    if (process.env.NODE_ENV === 'prod') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // X-XSS-Protection - 구형 브라우저의 XSS 필터 활성화
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy - 리퍼러 정보 제한
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy - 브라우저 기능 제한
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    next();
  }
}