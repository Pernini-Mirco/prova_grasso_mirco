function SkeletonLine({ short = false, tall = false }) {
  return (
    <span
      className={[
        'skeleton-line',
        short ? 'skeleton-line-short' : '',
        tall ? 'skeleton-line-tall' : ''
      ].filter(Boolean).join(' ')}
    />
  );
}

export default function LoadingState({
  message = 'Caricamento dati in corso...',
  variant = 'page'
}) {
  if (variant === 'table') {
    return (
      <div className="skeleton-shell" aria-live="polite" aria-busy="true">
        <div className="skeleton-header">
          <SkeletonLine short />
          <SkeletonLine tall />
          <SkeletonLine />
        </div>
        <div className="skeleton-table">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="skeleton-table-row">
              <span className="skeleton-avatar" />
              <SkeletonLine />
              <SkeletonLine short />
              <SkeletonLine short />
              <SkeletonLine short />
            </div>
          ))}
        </div>
        <p className="skeleton-caption">{message}</p>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="skeleton-shell" aria-live="polite" aria-busy="true">
        <div className="skeleton-header">
          <SkeletonLine short />
          <SkeletonLine tall />
          <SkeletonLine />
        </div>
        <div className="skeleton-card-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton-card-top">
                <span className="skeleton-avatar" />
                <div className="skeleton-card-copy">
                  <SkeletonLine short />
                  <SkeletonLine />
                </div>
              </div>
              <div className="skeleton-chip-row">
                <SkeletonLine short />
                <SkeletonLine short />
              </div>
            </div>
          ))}
        </div>
        <p className="skeleton-caption">{message}</p>
      </div>
    );
  }

  if (variant === 'prediction') {
    return (
      <div className="skeleton-shell" aria-live="polite" aria-busy="true">
        <div className="skeleton-header">
          <SkeletonLine short />
          <SkeletonLine tall />
          <SkeletonLine />
        </div>
        <div className="skeleton-prediction-grid">
          <div className="skeleton-card skeleton-card-tall">
            <SkeletonLine short />
            <SkeletonLine tall />
            <div className="skeleton-chip-row">
              <SkeletonLine />
              <SkeletonLine />
            </div>
          </div>
          <div className="skeleton-card skeleton-card-tall">
            <div className="skeleton-card-top">
              <span className="skeleton-avatar" />
              <SkeletonLine short />
              <span className="skeleton-avatar" />
            </div>
            <div className="skeleton-chip-row">
              <SkeletonLine short />
              <SkeletonLine short />
              <SkeletonLine short />
            </div>
            <SkeletonLine />
          </div>
        </div>
        <p className="skeleton-caption">{message}</p>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className="skeleton-shell" aria-live="polite" aria-busy="true">
        <div className="skeleton-header">
          <SkeletonLine short />
          <SkeletonLine tall />
          <SkeletonLine />
        </div>
        <div className="skeleton-hero">
          <div className="skeleton-card skeleton-card-tall">
            <SkeletonLine short />
            <SkeletonLine tall />
            <SkeletonLine />
            <div className="skeleton-chip-row">
              <SkeletonLine short />
              <SkeletonLine short />
              <SkeletonLine short />
              <SkeletonLine short />
            </div>
          </div>
          <div className="skeleton-card">
            <SkeletonLine short />
            <SkeletonLine />
            <SkeletonLine />
            <SkeletonLine />
          </div>
        </div>
        <div className="skeleton-card-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton-card">
              <SkeletonLine short />
              <SkeletonLine tall />
              <SkeletonLine />
            </div>
          ))}
        </div>
        <p className="skeleton-caption">{message}</p>
      </div>
    );
  }

  return (
    <div className="skeleton-shell" aria-live="polite" aria-busy="true">
      <div className="skeleton-header">
        <SkeletonLine short />
        <SkeletonLine tall />
        <SkeletonLine />
      </div>
      <div className="skeleton-card-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="skeleton-card">
            <SkeletonLine short />
            <SkeletonLine />
            <SkeletonLine />
          </div>
        ))}
      </div>
      <p className="skeleton-caption">{message}</p>
    </div>
  );
}
