import { useCallback, useEffect, useRef, useState } from 'react';
import type { AckResult, ChatMessage, RoomState } from '../../shared/protocol';
import { messageFx, stateFx } from './fx';
import { socket } from './socket';
import { getActiveRoom, getSessionId, loadProfile, roomFromUrl, saveProfile, setActiveRoom, setUrlRoom, type Profile } from './session';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Game from './screens/Game';
import GameEnd from './screens/GameEnd';

export interface GameData {
  room: RoomState;
  /** room:state'in alındığı yerel zaman; geri sayım için. */
  stateAt: number;
  meId: string;
  secret: string | null;
  choices: string[];
  messages: ChatMessage[];
  leave: () => void;
}

const sessionId = getSessionId();

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [stateAt, setStateAt] = useState(0);
  const [secret, setSecret] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastState = useRef<RoomState | null>(null);

  const handleAck = useCallback((res: AckResult) => {
    setBusy(false);
    if (res.ok) {
      setActiveRoom(res.code);
      setUrlRoom(res.code);
      setError(null);
    } else {
      setError(res.error);
      setActiveRoom(null);
    }
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Sayfa yenilendi ya da bağlantı koptuysa odaya otomatik geri dön.
      const code = getActiveRoom();
      if (code) {
        const p = loadProfile();
        socket.emit('room:join', { ...p, sessionId, code }, handleAck);
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: RoomState) => {
      stateFx(lastState.current, s, sessionId);
      lastState.current = s;
      setRoom(s);
      setStateAt(Date.now());
      if (s.phase === 'choosing' || s.phase === 'lobby') setSecret(null);
    };
    const onMessage = (m: ChatMessage) => {
      messageFx(m);
      setMessages((list) => [...list.slice(-150), m]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('word:choices', setChoices);
    socket.on('word:secret', setSecret);
    socket.on('chat:message', onMessage);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('word:choices', setChoices);
      socket.off('word:secret', setSecret);
      socket.off('chat:message', onMessage);
    };
  }, [handleAck]);

  const enter = (mode: 'create' | 'join', code?: string) => {
    saveProfile(profile);
    setBusy(true);
    setMessages([]);
    const payload = { ...profile, sessionId, code };
    if (mode === 'create') socket.emit('room:create', payload, handleAck);
    else socket.emit('room:join', payload, handleAck);
  };

  const leave = () => {
    socket.emit('room:leave');
    setActiveRoom(null);
    setUrlRoom(null);
    setRoom(null);
    setMessages([]);
    setSecret(null);
  };

  let screen;
  if (!room) {
    screen = (
      <Home
        profile={profile}
        onProfile={setProfile}
        initialCode={roomFromUrl()}
        busy={busy || !connected}
        error={error}
        onCreate={() => enter('create')}
        onJoin={(code) => enter('join', code)}
      />
    );
  } else {
    const data: GameData = { room, stateAt, meId: sessionId, secret, choices, messages, leave };
    if (room.phase === 'lobby') screen = <Lobby data={data} />;
    else if (room.phase === 'gameEnd') screen = <GameEnd data={data} />;
    else screen = <Game data={data} />;
  }

  return (
    <>
      {!connected && <div className="banner">Sunucuya bağlanılıyor…</div>}
      {screen}
    </>
  );
}
