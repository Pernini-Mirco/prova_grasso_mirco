function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function KpiCard({
  label,
  value,
  helper,
  target,
  delta,
  period,
  formula,
  status,
  accent = 'blue',
  attainment = 0
}) {
  const progressWidth = clamp(attainment * 100, 8, 100);

  return (
    <article className={`kpi-card kpi-card-${accent}`}>
      <div className="kpi-card-head">
        <p className="mini-label">{label}</p>
        <span className={`kpi-status-pill kpi-status-${status.tone}`}>{status.label}</span>
      </div>

      <h3>{value}</h3>
      <p className="helper">{helper}</p>

      <div className="kpi-progress" aria-hidden="true">
        <span className="kpi-progress-fill" style={{ width: `${progressWidth}%` }} />
      </div>

      <div className="kpi-meta-grid">
        <div>
          <span>Target</span>
          <strong>{target}</strong>
        </div>
        <div>
          <span>Delta</span>
          <strong>{delta}</strong>
        </div>
        <div>
          <span>Periodo</span>
          <strong>{period}</strong>
        </div>
      </div>

      <p className="kpi-formula">{formula}</p>
    </article>
  );
}
