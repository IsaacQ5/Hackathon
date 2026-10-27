import { iconUrl } from '../game/icons';

/** One hand-drawn icon (see game/icons.ts), sized with the text around it via the `.emo` class. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const url = iconUrl(name);
  if (!url) return null;
  return <img className={`emo ${className}`} src={url} alt="" draggable={false} />;
}
