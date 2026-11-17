// Uygulamanın kökü: sunucu bağlantısını ve oyun durumunu yönetir, uygun ekranı gösterir.
import type { AckResult, ChatMessage, ImpostorRole, JoinPayload, RevealData, RoomState, TelephoneTask } from '@shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFx, stateFx } from './effects/gameFx';
import { keepServerAwake, reconnectOnReturn } from './lib/connection';
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
import Impostor from './screens/Impostor';
import Lobby from './screens/Lobby';
import Reveal from './screens/Reveal';
import Telephone from './screens/Telephone';
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
  const [task, setTask] = useState<TelephoneTask | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [role, setRole] = useState<ImpostorRole | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Davet linkindeki oda kodu (?oda=KOD). */
  const [inviteCode, setInviteCode] = useState(roomFromUrl);
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
      if (!code) return;
      socket.emit('room:join', { ...loadProfile(), sessionId, code }, (res: AckResult) => {
        if (res.ok) return handleAck(res);
        // Oda artık yok (ör. sunucu yeniden başladı): uyarı göstermeden ana ekrana dön.
        setActiveRoom(null);
        setUrlRoom(null);
        setInviteCode(null);
        setRoom(null);
        lastState.current = null;
      });
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: RoomState) => {
      stateFx(lastState.current, s, meIdRef.current);
      lastState.current = s;
      setRoom(s);
      setStateAt(Date.now());
      if (s.phase === 'choosing' || s.phase === 'lobby') setSecret(null);
      if (s.phase !== 'telephone') setTask(null);
      if (s.phase !== 'reveal') setReveal(null);
      if (s.phase !== 'impostor') setRole(null);
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
    socket.on('tp:task', setTask);
    socket.on('tp:reveal', setReveal);
    socket.on('imp:role', setRole);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:customWords', setCustomWords);
      socket.off('word:choices', setChoices);
      socket.off('word:secret', setSecret);
      socket.off('chat:message', onMessage);
      socket.off('tp:task', setTask);
      socket.off('tp:reveal', setReveal);
      socket.off('imp:role', setRole);
    };
  }, [handleAck]);

  useEffect(() => reconnectOnReturn(), []);

  // Odadayken sunucu uyumasın.
  const inRoom = room !== null;
  useEffect(() => (inRoom ? keepServerAwake() : undefined), [inRoom]);

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
    setInviteCode(null);
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
        initialCode={inviteCode}
        busy={busy || !connected}
        error={error}
        onCreate={() => enter('create')}
        onJoin={(code) => enter('join', code)}
      />
    );
  } else {
    const data: GameData = { room, stateAt, meId, secret, choices, messages, customWords, task, reveal, role, leave };
    if (room.phase === 'lobby') screen = <Lobby data={data} />;
    else if (room.phase === 'gameEnd') screen = <GameEnd data={data} />;
    else if (room.phase === 'telephone') screen = <Telephone data={data} />;
    else if (room.phase === 'reveal') screen = <Reveal data={data} />;
    else if (room.phase === 'impostor') screen = <Impostor data={data} />;
    else screen = <Game data={data} />;
  }

  return (
    <>
      {!connected && <div className="banner">Sunucuya bağlanılıyor…</div>}
      {screen}
    </>
  );
}
