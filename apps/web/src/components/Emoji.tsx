import { Fragment, useState } from 'react';
import { emojiUrl, splitEmoji } from '../game/emoji3d';

/** One emoji drawn as its 3D model (falls back to the plain character if it can't load). */
export function Emoji({ ch, className = '' }: { ch: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = emojiUrl(ch);
  if (!url || failed) return <span className={`emo emo--txt ${className}`}>{ch}</span>;
  return <img className={`emo ${className}`} src={url} alt={ch} draggable={false} onError={() => setFailed(true)} />;
}

/** Text where any emoji inside it is swapped for its 3D model. */
export function EmojiText({ text }: { text: string }) {
  return (
    <>
      {splitEmoji(text).map((p, i) => (p.emoji ? <Emoji key={i} ch={p.text} /> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}
