// Uygulamanın kökü: sunucu bağlantısını ve oyun durumunu yönetir, uygun ekranı gösterir.
import type { AckResult, ChatMessage, ImpostorRole, JoinPayload, RevealData, RoomState, TelephoneTask } from '@shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { messageFx, stateFx } from './effects/gameFx';
import { getLang, useT } from './i18n';
import { keepServerAwake, reconnectOnReturn } from './lib/connection';
import { useNativeBack } from './lib/nativeBack';
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
import Home, { type HomeError } from './screens/Home';
import Impostor from './screens/Impostor';
import Lobby from './screens/Lobby';
import Reveal from './screens/Reveal';
import TeamRace from './screens/TeamRace';
import Telephone from './screens/Telephone';
import type { GameData } from './types';

/** Oda kurma/katılma isteğine bu sürede yanıt gelmezse vazgeçilir. */
const ACK_TIMEOUT_MS = 10_000;

/** Sohbette tutulan en fazla mesaj. */
const MAX_MESSAGES = 150;

const sessionId = getSessionId();

export default function App() {
  const t = useT();
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
  const [error, setError] = useState<HomeError | null>(null);
  const [busy, setBusy] = useState(false);
  /** Davet linkindeki oda kodu (?oda=KOD). */
  const [inviteCode, setInviteCode] = useState(roomFromUrl);
  const lastState = useRef<RoomState | null>(null);
  const meIdRef = useRef('');
  /** Kullanıcı odadan çıktı: sunucunun çıkıştan önce yolladığı (geç gelen) oda durumu ekranı geri açmasın. */
  const leftRef = useRef(false);

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

  /** Odadan çıkınca (kendi isteğiyle ya da atılınca) yerel durumu temizler. */
  const resetRoom = useCallback(() => {
    setActiveRoom(null);
    setUrlRoom(null);
    setInviteCode(null);
    setRoom(null);
    lastState.current = null;
    setMessages([]);
    setSecret(null);
    setCustomWords([]);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Sayfa yenilendi ya da bağlantı koptuysa odaya otomatik geri dön.
      const code = getActiveRoom();
      if (!code) return;
      leftRef.current = false;
      // Kullanıcı başka bir odanın davet linkiyle geldiyse eski odaya dönme: davet öncelikli.
      const invite = roomFromUrl();
      if (invite && invite !== code) {
        setActiveRoom(null);
        return;
      }
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit('room:join', { ...loadProfile(), sessionId, code, lang: getLang() }, (err: Error | null, res?: AckResult) => {
          if (!err && res?.ok) return handleAck(res);
          if (err) return; // yanıt gelmedi: bağlantı geri gelince yeniden denenir
          // Oda artık yok (ör. sunucu yeniden başladı): uyarı göstermeden ana ekrana dön.
          setActiveRoom(null);
          if (roomFromUrl() === code) {
            setUrlRoom(null);
            setInviteCode(null);
          }
          setRoom(null);
          lastState.current = null;
        });
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: RoomState) => {
      if (leftRef.current) return;
      stateFx(lastState.current, s, meIdRef.current);
      // Takım modunda yeni tur: önceki turun kelimesi silinsin (yeni çizenlere kelime bu durumdan sonra gelir).
      if (s.teams?.race && lastState.current?.teams?.race?.turn !== s.teams.race.turn) setSecret(null);
      lastState.current = s;
      setRoom(s);
      setStateAt(Date.now());
      if (s.phase === 'choosing' || s.phase === 'lobby') setSecret(null);
      if (s.phase !== 'telephone') setTask(null);
      if (s.phase !== 'reveal') setReveal(null);
      if (s.phase !== 'impostor') setRole(null);
    };
    const onKicked = () => {
      leftRef.current = true;
      resetRoom();
      setError('kickedByHost');
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
    socket.on('room:kicked', onKicked);
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
      socket.off('room:kicked', onKicked);
      socket.off('tp:task', setTask);
      socket.off('tp:reveal', setReveal);
      socket.off('imp:role', setRole);
    };
  }, [handleAck, resetRoom]);

  useEffect(() => reconnectOnReturn(), []);

  // Odadayken sunucu uyumasın.
  const inRoom = room !== null;
  useEffect(() => (inRoom ? keepServerAwake() : undefined), [inRoom]);

  const enter = (mode: 'create' | 'join', code?: string) => {
    saveProfile(profile);
    leftRef.current = false;
    setBusy(true);
    setMessages([]);
    const payload: JoinPayload = { ...profile, sessionId, code, lang: getLang() };
    // Yanıt hiç gelmezse buton takılı kalmasın.
    socket
      .timeout(ACK_TIMEOUT_MS)
      .emit(mode === 'create' ? 'room:create' : 'room:join', payload, (err: Error | null, res?: AckResult) => {
        if (err || !res) {
          setBusy(false);
          setError('unreachable');
        } else handleAck(res);
      });
  };

  const leave = () => {
    leftRef.current = true;
    socket.emit('room:leave');
    resetRoom();
  };

  // Android uygulamasında geri tuşu: pencereyi kapat / odadan çıkmayı sor / arka plana al.
  useNativeBack({ inRoom, confirmText: t('game.leaveConfirm'), leave });

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
    else if (room.phase === 'teams') screen = <TeamRace data={data} />;
    else screen = <Game data={data} />;
  }

  return (
    <>
      {!connected && <div className="banner">{t('common.connecting')}</div>}
      {screen}
    </>
  );
}
