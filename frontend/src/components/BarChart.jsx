export default function BarChart({ title, items, suffix = '', percent = false }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      <div className="bars">
        {items.map((item) => (
          <div key={item.label} className="bar-row">
            <span className="bar-label">{item.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <strong className="bar-value">
              {item.value}
              {percent ? '%' : suffix}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
