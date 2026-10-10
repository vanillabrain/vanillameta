import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * 쿼리 진행상황 수신용 socket.io 싱글톤.
 * API 요청 시 X-Socket-Id 헤더로 연결된 socket id를 내면,
 * 서버가 query:progress 이벤트를 이 소켓으로 푸시한다.
 */
export function connectSocket(): Socket {
  if (!socket) {
    const apiUrl = import.meta.env.REACT_APP_API_URL as string | undefined;
    const origin = apiUrl ? new URL(apiUrl).origin : window.location.origin;
    socket = io(`${origin}/query-progress`, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function getSocketId(): string | undefined {
  return socket?.connected ? socket.id : undefined;
}
