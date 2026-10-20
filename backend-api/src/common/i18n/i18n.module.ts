import { Module, Global } from '@nestjs/common';
import {
  I18nModule as NestI18nModule,
  AcceptLanguageResolver,
  QueryResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import * as path from 'path';

@Global()
@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: 'ko', // 기본 언어를 한국어로 설정
      loaderOptions: {
        path: path.join(__dirname, '../../i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'locale'] }, // ?lang=en 또는 ?locale=en
        new HeaderResolver(['x-custom-lang', 'x-locale']), // 커스텀 헤더
        AcceptLanguageResolver, // Accept-Language 헤더
      ],
    }),
  ],
  exports: [NestI18nModule],
})
export class I18nModule {}
