export default function MetricCard({ label, value, helper, accent = 'amber' }) {
  return (
    <article className={`metric-card metric-card-${accent}`}>
      <div className="metric-card-top">
        <p className="mini-label">{label}</p>
        <span className="metric-card-dot" />
      </div>
      <h3>{value}</h3>
      {helper ? <p className="helper">{helper}</p> : null}
    </article>
  );
}
