interface Props {
  connected: boolean;
  label?: string;
}

export function ConnectionBadge({ connected, label }: Props) {
  return (
    <span className={`conn ${connected ? 'conn--on' : 'conn--off'}`} role="status" aria-live="polite">
      <span className="conn__dot" />
      {label ?? (connected ? 'Connected' : 'Reconnecting…')}
    </span>
  );
}
