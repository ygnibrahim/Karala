import type { ClientToServer, ServerToClient } from '@shared';
import { io, type Socket } from 'socket.io-client';

// Geliştirmede Vite, /socket.io isteklerini sunucuya yönlendirir; bu yüzden aynı adrese bağlanmak yeterli.
const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined;

export const socket: Socket<ServerToClient, ClientToServer> = serverUrl
  ? io(serverUrl, { transports: ['websocket', 'polling'] })
  : io({ transports: ['websocket', 'polling'] });
