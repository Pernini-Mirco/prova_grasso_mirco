import { useId } from 'react';

function buildPoints(data) {
  const cleaned = (data || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));

  if (!cleaned.length) {
    return '';
  }

  const min = Math.min(...cleaned);
  const max = Math.max(...cleaned);
  const range = max - min || 1;

  return cleaned
    .map((value, index) => {
      const x = cleaned.length === 1 ? 50 : (index / (cleaned.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x},${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function Sparkline({ data = [], tone = 'neutral', label = 'Trend' }) {
  const gradientId = useId();
  const points = buildPoints(data);

  if (!points) {
    return null;
  }

  return (
    <div className={`sparkline sparkline-${tone}`} aria-label={label}>
      <svg viewBox="0 0 100 32" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" />
            <stop offset="100%" />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
