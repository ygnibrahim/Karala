// Uygulamanın kökü: sunucu bağlantısını ve oyun durumunu yönetir, uygun ekranı gösterir.
import type { AckResult, ChatMessage, JoinPayload, RoomState } from '@shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFx, stateFx } from './effects/gameFx';
import {
  getActiveRoom,
  getSessionId,
  loadProfile,
  type Profile,
  roomFromUrl,
  saveProfile,
  setActiveRoom,
  setUrlRoom,
} from './lib/session';
import { socket } from './lib/socket';
import Game from './screens/Game';
import GameEnd from './screens/GameEnd';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import type { GameData } from './types';

/** Sohbette tutulan en fazla mesaj. */
const MAX_MESSAGES = 150;

const sessionId = getSessionId();

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [meId, setMeId] = useState('');
  const [stateAt, setStateAt] = useState(0);
  const [secret, setSecret] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastState = useRef<RoomState | null>(null);
  const meIdRef = useRef('');

  const handleAck = useCallback((res: AckResult) => {
    setBusy(false);
    if (res.ok) {
      meIdRef.current = res.playerId;
      setMeId(res.playerId);
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
      if (code) socket.emit('room:join', { ...loadProfile(), sessionId, code }, handleAck);
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: RoomState) => {
      stateFx(lastState.current, s, meIdRef.current);
      lastState.current = s;
      setRoom(s);
      setStateAt(Date.now());
      if (s.phase === 'choosing' || s.phase === 'lobby') setSecret(null);
    };
    const onMessage = (m: ChatMessage) => {
      messageFx(m);
      setMessages((list) => [...list.slice(-MAX_MESSAGES), m]);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('room:customWords', setCustomWords);
    socket.on('word:choices', setChoices);
    socket.on('word:secret', setSecret);
    socket.on('chat:message', onMessage);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:customWords', setCustomWords);
      socket.off('word:choices', setChoices);
      socket.off('word:secret', setSecret);
      socket.off('chat:message', onMessage);
    };
  }, [handleAck]);

  const enter = (mode: 'create' | 'join', code?: string) => {
    saveProfile(profile);
    setBusy(true);
    setMessages([]);
    const payload: JoinPayload = { ...profile, sessionId, code };
    socket.emit(mode === 'create' ? 'room:create' : 'room:join', payload, handleAck);
  };

  const leave = () => {
    socket.emit('room:leave');
    setActiveRoom(null);
    setUrlRoom(null);
    setRoom(null);
    lastState.current = null;
    setMessages([]);
    setSecret(null);
    setCustomWords([]);
  };

  let screen: React.ReactNode;
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
    const data: GameData = { room, stateAt, meId, secret, choices, messages, customWords, leave };
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
