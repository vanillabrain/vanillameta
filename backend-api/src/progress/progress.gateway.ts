import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { resolveCorsOrigins } from '../config/cors-origins';

/**
 * 쿼리 진행상황 푸시용 WebSocket 게이트웨이.
 * 클라이언트는 socket.io로 접속하고, 쿼리 API 호출 시 X-Socket-Id 헤더로
 * 자신의 socket id를 보낸다. 서버는 해당 socket room으로만 이벤트를 보낸다.
 */
@Injectable()
@WebSocketGateway({
  namespace: 'query-progress',
  cors: {
    origin: resolveCorsOrigins(process.env.CORS_ORIGIN, process.env.NODE_ENV),
    credentials: true,
  },
})
export class ProgressGateway {
  @WebSocketServer()
  server: Server;

  emitTo(clientId: string | undefined, event: string, payload: unknown) {
    if (!clientId || !this.server) return;
    this.server.to(clientId).emit(event, payload);
  }
}
