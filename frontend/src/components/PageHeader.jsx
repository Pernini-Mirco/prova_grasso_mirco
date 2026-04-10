import brandLogo from '../assets/brand/league-intelligence-logo.svg';

export default function PageHeader({ title, subtitle, eyebrow = 'Analisi NBA', actions }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <div className="page-header-brand">
          <img src={brandLogo} alt="League Intelligence" className="page-header-logo" />
          <p className="eyebrow">{eyebrow}</p>
        </div>
        <h2>{title}</h2>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}
