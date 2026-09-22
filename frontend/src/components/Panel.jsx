export function Panel({ title, badge, action, children }) {
  return (
    <div className="panel">
      {title && (
        <div className="panel-header">
          <div className="panel-header-title">
            <span>{title}</span>
            {badge && <span className="panel-header-badge">{badge}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div>{children}</div>
    </div>
  );
}
