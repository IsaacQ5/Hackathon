import { useState } from 'react';
import { CHEF_FACES, FACE_NAMES, PLAYER_COLORS, type ChefFace, type PublicPlayer } from '@tilt-mayhem/shared';
import { api } from '../network/socket';
import { ChefPortrait } from './ChefPortrait';

interface Props {
  color: string;
  face: ChefFace;
  players: PublicPlayer[];
  myId: string;
}

/** Lobby-only: pick a colour nobody else has, and a face. The server has the final say. */
export function CustomizeCard({ color, face, players, myId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(players.filter((p) => p.id !== myId).map((p) => p.color));

  const change = async (look: { color?: string; face?: ChefFace }) => {
    setError(null);
    const res = await api.customize(look);
    if (!res.ok) setError(res.error.message);
  };

  return (
    <section className="kcard kcustom">
      <h3>Customize your chef</h3>
      <p className="kcustom__label">Colour</p>
      <div className="kcustom__colors">
        {PLAYER_COLORS.map((c) => {
          const mine = c === color;
          const used = taken.has(c);
          return (
            <button
              key={c}
              className={`kcustom__swatch ${mine ? 'is-on' : ''} ${used ? 'is-taken' : ''}`}
              style={{ background: c }}
              disabled={used || mine}
              onClick={() => void change({ color: c })}
              aria-label={used ? 'Colour taken' : mine ? 'Your colour' : 'Pick this colour'}
            >
              {used ? '✕' : mine ? '✔' : ''}
            </button>
          );
        })}
      </div>
      <p className="kcustom__label">Face</p>
      <div className="kcustom__faces">
        {CHEF_FACES.map((f) => (
          <button key={f} className={`kcustom__face ${f === face ? 'is-on' : ''}`} onClick={() => void change({ face: f })}>
            <ChefPortrait color={color} face={f} size={56} />
            <span>{FACE_NAMES[f]}</span>
          </button>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
    </section>
  );
}
