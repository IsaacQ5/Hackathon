import { useState } from 'react';
import { ROUND_MINUTE_OPTIONS, type GamePhase, type RoomState } from '@tilt-mayhem/shared';
import { api } from '../network/socket';
import { sfx } from '../utils/sound';

interface Props {
  room: RoomState;
  phase: GamePhase;
}

/** On the head chef's phone between shifts: shift length + the big start / next shift button. */
export function HeadChefCard({ room, phase }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = room.players.filter((p) => p.connected).length;
  const need = Math.max(0, room.minPlayers - connected);
  const minutes = Math.round(room.roundDurationMs / 60_000);

  const setLength = async (m: number) => {
    setError(null);
    const res = await api.setRoundMinutes(m);
    if (!res.ok) setError(res.error.message);
  };

  const start = async () => {
    sfx.unlock();
    setBusy(true);
    setError(null);
    const res = phase === 'results' ? await api.rematch() : await api.startGame();
    setBusy(false);
    if (!res.ok) setError(res.error.message);
  };

  return (
    <section className="kcard kheadchef">
      <p className="kcustom__label">Shift length</p>
      <div className="kseg">
        {ROUND_MINUTE_OPTIONS.map((m) => (
          <button key={m} className={m === minutes ? 'is-on' : ''} onClick={() => void setLength(m)}>
            {m} min
          </button>
        ))}
      </div>
      <button className="kbtn kbtn--go" onClick={() => void start()} disabled={busy || need > 0}>
        {busy
          ? 'Starting…'
          : need > 0
            ? `Need ${need} more chef${need === 1 ? '' : 's'}`
            : phase === 'results'
              ? 'NEXT SHIFT!'
              : 'OPEN THE KITCHEN!'}
      </button>
      {error && <p className="error small">{error}</p>}
    </section>
  );
}
