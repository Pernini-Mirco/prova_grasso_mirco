export default function Tooltip({ content, children, className = '' }) {
  return (
    <span className={`tooltip ${className}`.trim()} tabIndex={0}>
      {children}
      <span className="tooltip-bubble" role="tooltip">
        {content}
      </span>
    </span>
  );
}
