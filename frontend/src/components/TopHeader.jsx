import React from "react";

export default function TopHeader({ pageTitle, pageDescription, currentUser, theme, onToggleTheme }) {
  const shortAddr = currentUser?.address
    ? `${currentUser.address.slice(0, 6)}...${currentUser.address.slice(-4)}`
    : "Not Connected";

  return (
    <header className="app-top-header">
      <div className="header-page-title-group">
        <h1 className="header-title">{pageTitle}</h1>
        {pageDescription && <p className="header-subtitle">{pageDescription}</p>}
      </div>

      <div className="header-status-pills">
        {/* Light / Dark Mode Toggle Button */}
        <button 
          className="theme-toggle-btn" 
          type="button" 
          onClick={onToggleTheme}
          title="Toggle Light or Dark Theme"
        >
          {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>

        <div className="hstatus-pill">
          <span className="hpill-label">NETWORK</span>
          <div className="hpill-value">
            <span>Ganache Local</span>
            <span className="hdot green" />
          </div>
        </div>

        <div className="hstatus-pill">
          <span className="hpill-label">WALLET</span>
          <div className="hpill-value monospace">
            <span>{shortAddr}</span>
            <span className="hdot blue" />
          </div>
        </div>

        <div className="hstatus-pill">
          <span className="hpill-label">STATUS</span>
          <div className="hpill-value">
            <span>{currentUser?.isSuperAdmin ? "Super Admin" : "Authorized User"}</span>
            <span className="hdot green" />
          </div>
        </div>
      </div>
    </header>
  );
}

