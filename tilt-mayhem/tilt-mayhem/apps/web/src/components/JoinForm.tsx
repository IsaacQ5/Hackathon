import { useState, type FormEvent } from 'react';
import { NICKNAME_MAX_LENGTH, type ServerError } from '@tilt-mayhem/shared';

interface Props {
  code: string;
  defaultNickname: string;
  busy: boolean;
  error: ServerError | null;
  onSubmit: (nickname: string) => void;
}

export function JoinForm({ code, defaultNickname, busy, error, onSubmit }: Props) {
  const [nickname, setNickname] = useState(defaultNickname);
  const trimmed = nickname.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && !busy) onSubmit(trimmed);
  };

  return (
    <form className="join card" onSubmit={submit}>
      <p className="join__room">
        Room <b>{code}</b>
      </p>
      <label className="join__label" htmlFor="nickname">
        Your nickname
      </label>
      <input
        id="nickname"
        className="input"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={NICKNAME_MAX_LENGTH}
        placeholder="e.g. Tilty McTiltface"
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="go"
        autoFocus
      />
      <button className="btn btn--big btn--go" type="submit" disabled={!trimmed || busy}>
        {busy ? 'Joining…' : 'Join game'}
      </button>
      {error && <p className="error">{error.message}</p>}
      <p className="muted small">Tapping Join also asks for motion access, so you can steer by tilting.</p>
    </form>
  );
}
