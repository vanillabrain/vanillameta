import { config } from 'dotenv';
import { join } from 'path';

// AppModule 이 로드되기 전에 실행된다 (jest setupFiles).
// NODE_ENV 를 먼저 지정해야 app.module 이 SQLite/테스트 설정을 선택한다.
process.env.NODE_ENV = 'test';

config({ path: join(__dirname, '..', '..', '.env.test') });
