import { useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH, type ServerError } from '@tilt-mayhem/shared';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { useConnection } from '../hooks/useConnection';
import { storage } from '../network/session';
import { api } from '../network/socket';
import { navigate } from '../utils/router';
import { sfx } from '../utils/sound';

export function HomePage() {
  const connected = useConnection();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ServerError | null>(null);
  const [code, setCode] = useState('');
  const isPhone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  const create = async () => {
    sfx.unlock();
    setCreating(true);
    setError(null);
    const res = await api.createRoom('Host');
    setCreating(false);
    if (!res.ok) return setError(res.error);
    storage.setHostToken(res.code, res.token);
    navigate(`/host/${res.code}`);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length === ROOM_CODE_LENGTH) navigate(`/play/${c}`);
  };

  const joinCard = (
    <form className="card home__card" onSubmit={join}>
      <h2>📱 Join a game</h2>
      <p className="muted">Enter the code shown on the big screen.</p>
      <input
        className="input input--code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, ROOM_CODE_LENGTH))}
        placeholder="ABCD"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="Room code"
      />
      <button className="btn btn--big btn--go" disabled={code.length !== ROOM_CODE_LENGTH}>
        Join
      </button>
    </form>
  );

  const hostCard = (
    <div className="card home__card">
      <h2>📺 Host a game</h2>
      <p className="muted">Open this on a laptop or TV. Players join with their phones.</p>
      <button className="btn btn--big" onClick={create} disabled={creating || !connected}>
        {creating ? 'Creating…' : 'Create room'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </div>
  );

  return (
    <div className="home">
      <header className="home__hero">
        <h1 className="logo">
          TILT <span>MAYHEM</span>
        </h1>
        <p className="tagline">Your phone is the controller. Tilt, roll, grab the gems.</p>
        <ConnectionBadge connected={connected} label={connected ? 'Server online' : 'Connecting to server…'} />
      </header>
      <main className="home__cards">
        {isPhone ? (
          <>
            {joinCard}
            {hostCard}
          </>
        ) : (
          <>
            {hostCard}
            {joinCard}
          </>
        )}
      </main>
    </div>
  );
}
