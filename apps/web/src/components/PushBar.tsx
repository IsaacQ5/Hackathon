import { PUSH } from '@tilt-mayhem/shared';
import { EmojiText } from './Emoji';

interface Props {
  /** ms until the push is ready again (0 = ready). */
  readyInMs: number;
  /** No motion sensors: the bar itself is a PUSH button. */
  tapToPush: boolean;
  onPush: () => void;
}

/** Push cooldown, shown above the movement circle. Fills up over 5 s; glows when ready. */
export function PushBar({ readyInMs, tapToPush, onPush }: Props) {
  const ready = readyInMs <= 0;
  const fill = ready ? 1 : 1 - readyInMs / PUSH.cooldownMs;
  const label = ready
    ? tapToPush
      ? '💥 TAP TO PUSH (next to a chef)'
      : '💥 SHAKE TO PUSH (next to a chef)'
    : `Push recharging… ${Math.ceil(readyInMs / 1000)}s`;
  return (
    <button className={`kpush ${ready ? 'is-ready' : ''}`} disabled={!tapToPush || !ready} onClick={onPush}>
      <span className="kpush__fill" style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
      <span className="kpush__label">
        <EmojiText text={label} />
      </span>
    </button>
  );
}
