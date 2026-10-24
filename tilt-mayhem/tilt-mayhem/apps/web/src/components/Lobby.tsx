import { colorVar } from '../utils/style';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { RoomState, ServerError } from '@tilt-mayhem/shared';

interface Props {
  room: RoomState;
  joinUrl: string;
  onStart: () => void;
  starting: boolean;
  error: ServerError | null;
}

export function Lobby({ room, joinUrl, onStart, starting, error }: Props) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 360, color: { dark: '#120a2b', light: '#ffffff' } })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const connected = room.players.filter((p) => p.connected).length;
  const need = Math.max(0, room.minPlayers - connected);
  const isLocal = /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(joinUrl);
  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  return (
    <div className="lobby">
      <section className="lobby__join card">
        <h2>Join on your phone</h2>
        {qr ? <img className="lobby__qr" src={qr} alt={`QR code for ${joinUrl}`} /> : <div className="lobby__qr lobby__qr--empty" />}
        <p className="lobby__url">{joinUrl.replace(/^https?:\/\//, '')}</p>
        <p className="lobby__code-label">Room code</p>
        <p className="lobby__code">{room.code}</p>
        {isLocal && (
          <p className="warn">
            Phones can't open <b>localhost</b>. Set <code>VITE_PUBLIC_URL</code> to your LAN or tunnel URL (see README).
          </p>
        )}
      </section>

      <section className="lobby__players card">
        <div className="lobby__head">
          <h2>Players</h2>
          <span className="pill">
            {room.players.length} / {room.maxPlayers}
          </span>
        </div>
        <ul className="slots">
          {slots.map((p, i) =>
            p ? (
              <li key={p.id} className="slot slot--filled" style={colorVar(p.color)}>
                <span className="avatar">{Array.from(p.nickname)[0]?.toUpperCase()}</span>
                <span className="slot__name">{p.nickname}</span>
                {!p.connected && <span className="slot__away">away</span>}
              </li>
            ) : (
              <li key={`empty-${i}`} className="slot slot--empty">
                Waiting…
              </li>
            ),
          )}
        </ul>

        <ol className="howto">
          <li>Scan the code or open the link.</li>
          <li>Enter a nickname and tap <b>Join</b>.</li>
          <li>Hold your phone flat like a tray and allow motion access.</li>
          <li>
            Tilt to roll around. Gems = 1 pt, <span className="gold">gold stars = 3 pts</span>.
          </li>
        </ol>

        <button className="btn btn--big btn--go" onClick={onStart} disabled={need > 0 || starting}>
          {starting ? 'Starting…' : need > 0 ? `Need ${need} more player${need === 1 ? '' : 's'}` : 'Start game'}
        </button>
        {error && <p className="error">{error.message}</p>}
      </section>
    </div>
  );
}
