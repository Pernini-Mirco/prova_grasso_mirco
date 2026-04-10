import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';

import DashboardPage from './pages/DashboardPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import GamesPage from './pages/GamesPage.jsx';
import PredictionsPage from './pages/PredictionsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SearchPage from './components/SearchPage.jsx';
import brandLogo from './assets/brand/league-intelligence-logo.svg';
import dashboardIcon from './assets/nav/dashboard-icon.svg';
import teamsIcon from './assets/nav/teams-icon.svg';
import playersIcon from './assets/nav/players-icon.svg';
import gamesIcon from './assets/nav/games-icon.svg';
import predictionsIcon from './assets/nav/predictions-icon.svg';
import searchIcon from './assets/nav/search-icon.svg';
import adminIcon from './assets/nav/dashboard-icon.svg';
import profileAvatarIcon from './assets/nav/profile-avatar-icon.svg';

const links = [
  { to: '/', label: 'Dashboard', icon: dashboardIcon },
  { to: '/teams', label: 'Squadre', icon: teamsIcon },
  { to: '/players', label: 'Giocatori', icon: playersIcon },
  { to: '/games', label: 'Partite', icon: gamesIcon },
  { to: '/predictions', label: 'Predizioni', icon: predictionsIcon },
  { to: '/search', label: 'Ricerca', icon: searchIcon }
];

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem('analisi-nba-session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem('analisi-nba-session');
      return null;
    }
  });
  const navLinks = [
    ...links,
    ...(session?.user?.role === 'admin'
      ? [{ to: '/admin', label: 'Admin', icon: adminIcon }]
      : [])
  ];

  function handleAuth(payload) {
    setSession(payload);
    localStorage.setItem('analisi-nba-session', JSON.stringify(payload));
  }

  function handleLogout() {
    setSession(null);
    localStorage.removeItem('analisi-nba-session');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-block">
            <img src={brandLogo} alt="League Intelligence" className="brand-logo" />
            <div>
              <p className="brand-kicker">Analisi NBA</p>
              <h1>League Intelligence</h1>
            </div>
          </div>

          <nav className="nav-list">
            {navLinks.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">
                  <img src={icon} alt="" className="nav-icon-image" />
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="content">
        <div className="main-stage">
          <div className="app-topbar">
            <Link
              to="/login"
              className={`app-access-fab ${session ? 'is-authenticated' : ''}`}
              aria-label={session ? `Apri account di ${session.user.name}` : 'Apri accesso'}
              title={session ? session.user.name : 'Accesso'}
            >
              <img src={profileAvatarIcon} alt="" className="app-access-fab-icon" />
              {session ? <span className="app-access-fab-status" aria-hidden="true" /> : null}
            </Link>
          </div>

          <div className="route-stage">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/predictions" element={<PredictionsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/admin" element={<AdminPage session={session} />} />
              <Route
                path="/login"
                element={<LoginPage onAuth={handleAuth} onLogout={handleLogout} session={session} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}
