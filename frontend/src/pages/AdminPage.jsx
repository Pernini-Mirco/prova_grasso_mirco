import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import Loader from '../components/Loader.jsx';
import { getTeamLogo } from '../data/TeamsLogo.js';

const GAME_STATUS_OPTIONS = ['Scheduled', 'Final', 'Postponed'];

function teamStatsToForm(team) {
  return {
    wins: team?.stats?.wins ?? 0,
    losses: team?.stats?.losses ?? 0,
    pointsPerGame: team?.stats?.pointsPerGame ?? 0,
    pointsAllowedPerGame: team?.stats?.pointsAllowedPerGame ?? 0,
    reboundsPerGame: team?.stats?.reboundsPerGame ?? 0,
    assistsPerGame: team?.stats?.assistsPerGame ?? 0,
    recentForm: team?.stats?.recentForm ?? 0
  };
}

function gameToForm(game) {
  return {
    homeScore: game?.homeScore ?? 0,
    awayScore: game?.awayScore ?? 0,
    status: game?.status ?? 'Scheduled',
    arena: game?.arena ?? '',
    datetimeUtc: game?.datetimeUtc ? String(game.datetimeUtc).replace(' ', 'T').slice(0, 16) : ''
  };
}

function formatGameLabel(game) {
  if (!game) {
    return 'Seleziona partita';
  }

  return `${game.homeTeam.abbreviation} vs ${game.awayTeam.abbreviation}`;
}

function formatGameMeta(game) {
  if (!game) {
    return 'Data non disponibile';
  }

  return `${game.date || 'Data n/d'} / ${game.status || 'Scheduled'}`;
}

function AdminSelect({ label, open, onOpenChange, triggerContent, placeholder, children, menuClassName = '' }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        onOpenChange(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="team-select admin-select">
      {label ? <span className="team-select-label">{label}</span> : null}
      <button
        type="button"
        className={`team-select-trigger${open ? ' team-select-trigger-open' : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {triggerContent || <span className="team-select-placeholder">{placeholder}</span>}
        <span className="team-select-caret">{open ? '-' : '+'}</span>
      </button>

      {open ? <div className={`team-select-menu admin-select-menu ${menuClassName}`.trim()}>{children}</div> : null}
    </div>
  );
}

export default function AdminPage({ session }) {
  const [editorData, setEditorData] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [teamForm, setTeamForm] = useState(null);
  const [gameForm, setGameForm] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [openPicker, setOpenPicker] = useState('');

  const token = session?.token;
  const isAdmin = session?.user?.role === 'admin';

  async function loadEditor() {
    const payload = await api('/api/admin/editor', { authToken: token });
    setEditorData(payload);
  }

  useEffect(() => {
    if (isAdmin && token) {
      loadEditor().catch((error) => setMessage(error.message));
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (!editorData?.teams?.length) {
      return;
    }

    const selectedTeam =
      editorData.teams.find((team) => String(team.id) === String(selectedTeamId)) || editorData.teams[0];

    setSelectedTeamId(String(selectedTeam.id));
    setTeamForm(teamStatsToForm(selectedTeam));
  }, [editorData?.teams, selectedTeamId]);

  useEffect(() => {
    if (!editorData?.games?.length) {
      return;
    }

    const selectedGame =
      editorData.games.find((game) => String(game.id) === String(selectedGameId)) || editorData.games[0];

    setSelectedGameId(String(selectedGame.id));
    setGameForm(gameToForm(selectedGame));
  }, [editorData?.games, selectedGameId]);

  const selectedTeam = useMemo(
    () => editorData?.teams?.find((team) => String(team.id) === String(selectedTeamId)) ?? null,
    [editorData?.teams, selectedTeamId]
  );
  const selectedGame = useMemo(
    () => editorData?.games?.find((game) => String(game.id) === String(selectedGameId)) ?? null,
    [editorData?.games, selectedGameId]
  );

  async function saveTeamStats(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = await api(`/api/admin/teams/${selectedTeamId}/stats`, {
        method: 'PUT',
        authToken: token,
        body: JSON.stringify(teamForm)
      });
      setMessage(payload.message);
      await loadEditor();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveGame(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = await api(`/api/admin/games/${selectedGameId}`, {
        method: 'PUT',
        authToken: token,
        body: JSON.stringify({
          ...gameForm,
          datetimeUtc: gameForm.datetimeUtc || null
        })
      });
      setMessage(payload.message);
      await loadEditor();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!session?.user) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="Admin" title="Area amministratore" subtitle="Accesso riservato al personale autorizzato." />
        <section className="panel state-box">
          <p>Effettua prima il login come amministratore.</p>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-stack">
        <PageHeader eyebrow="Admin" title="Area amministratore" subtitle="Ambiente protetto per la gestione e l'aggiornamento dei dati." />
        <section className="panel state-box">
          <p>Il tuo account e autenticato ma non ha i permessi amministrativi.</p>
        </section>
      </div>
    );
  }

  if (!editorData || !teamForm || !gameForm) {
    return <Loader />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Admin"
        title="Controllo amministratore"
        subtitle="Workspace riservato per supervisione, verifica e aggiornamento dei dati."
      />

      <section className="admin-grid">
        <article className="panel admin-panel">
          <div className="panel-head">
            <div>
              <p className="mini-label">Team Stats</p>
              <h3>Modifica statistiche squadra</h3>
            </div>
          </div>

          <form className="form-panel admin-form" onSubmit={saveTeamStats}>
            <AdminSelect
              label="Squadra"
              open={openPicker === 'team'}
              onOpenChange={(nextOpen) => setOpenPicker(nextOpen ? 'team' : '')}
              placeholder="Seleziona squadra"
              triggerContent={
                selectedTeam ? (
                  <div className="team-select-trigger-main">
                    <img
                      src={getTeamLogo(selectedTeam.abbreviation)}
                      alt={selectedTeam.name}
                      className="team-logo team-select-logo"
                    />
                    <div className="team-select-copy">
                      <strong>{selectedTeam.name}</strong>
                      <span>{selectedTeam.abbreviation} / {selectedTeam.conference}</span>
                    </div>
                  </div>
                ) : null
              }
            >
              {editorData.teams.map((team) => {
                const isActive = String(team.id) === String(selectedTeamId);

                return (
                  <button
                    key={team.id}
                    type="button"
                    className={`team-select-option${isActive ? ' team-select-option-active' : ''}`}
                    onClick={() => {
                      setSelectedTeamId(String(team.id));
                      setOpenPicker('');
                    }}
                  >
                    <img
                      src={getTeamLogo(team.abbreviation)}
                      alt={team.name}
                      className="team-logo team-select-option-logo"
                    />
                    <div className="team-select-option-copy">
                      <strong>{team.name}</strong>
                      <span>{team.abbreviation} / {team.city}</span>
                    </div>
                  </button>
                );
              })}
            </AdminSelect>

            <div className="admin-form-grid">
              <label>
                Wins
                <input
                  type="number"
                  value={teamForm.wins}
                  onChange={(event) => setTeamForm((old) => ({ ...old, wins: event.target.value }))}
                />
              </label>
              <label>
                Losses
                <input
                  type="number"
                  value={teamForm.losses}
                  onChange={(event) => setTeamForm((old) => ({ ...old, losses: event.target.value }))}
                />
              </label>
              <label>
                PPG
                <input
                  type="number"
                  step="0.01"
                  value={teamForm.pointsPerGame}
                  onChange={(event) => setTeamForm((old) => ({ ...old, pointsPerGame: event.target.value }))}
                />
              </label>
              <label>
                Opp PPG
                <input
                  type="number"
                  step="0.01"
                  value={teamForm.pointsAllowedPerGame}
                  onChange={(event) => setTeamForm((old) => ({ ...old, pointsAllowedPerGame: event.target.value }))}
                />
              </label>
              <label>
                RPG
                <input
                  type="number"
                  step="0.01"
                  value={teamForm.reboundsPerGame}
                  onChange={(event) => setTeamForm((old) => ({ ...old, reboundsPerGame: event.target.value }))}
                />
              </label>
              <label>
                APG
                <input
                  type="number"
                  step="0.01"
                  value={teamForm.assistsPerGame}
                  onChange={(event) => setTeamForm((old) => ({ ...old, assistsPerGame: event.target.value }))}
                />
              </label>
              <label>
                Recent Form
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.001"
                  value={teamForm.recentForm}
                  onChange={(event) => setTeamForm((old) => ({ ...old, recentForm: event.target.value }))}
                />
              </label>
            </div>

            <div className="admin-toolbar">
              <div className="helper">
                {selectedTeam ? `${selectedTeam.name} / ruolo: solo admin` : 'Seleziona una squadra'}
              </div>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva statistiche'}
              </button>
            </div>
          </form>
        </article>

        <article className="panel admin-panel">
          <div className="panel-head">
            <div>
              <p className="mini-label">Games</p>
              <h3>Modifica partita</h3>
            </div>
          </div>

          <form className="form-panel admin-form" onSubmit={saveGame}>
            <AdminSelect
              label="Partita"
              open={openPicker === 'game'}
              onOpenChange={(nextOpen) => setOpenPicker(nextOpen ? 'game' : '')}
              placeholder="Seleziona partita"
              triggerContent={
                selectedGame ? (
                  <div className="team-select-trigger-main admin-game-select-trigger">
                    <div className="admin-game-select-logos">
                      <img
                        src={getTeamLogo(selectedGame.homeTeam.abbreviation)}
                        alt={selectedGame.homeTeam.name}
                        className="team-logo admin-mini-logo"
                      />
                      <img
                        src={getTeamLogo(selectedGame.awayTeam.abbreviation)}
                        alt={selectedGame.awayTeam.name}
                        className="team-logo admin-mini-logo"
                      />
                    </div>
                    <div className="team-select-copy admin-game-select-copy">
                      <strong>{formatGameLabel(selectedGame)}</strong>
                      <span>{formatGameMeta(selectedGame)}</span>
                    </div>
                  </div>
                ) : null
              }
              menuClassName="admin-select-menu-wide"
            >
              {editorData.games.map((game) => {
                const isActive = String(game.id) === String(selectedGameId);

                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`team-select-option admin-game-select-option${isActive ? ' team-select-option-active' : ''}`}
                    onClick={() => {
                      setSelectedGameId(String(game.id));
                      setOpenPicker('');
                    }}
                  >
                    <div className="admin-game-select-logos">
                      <img
                        src={getTeamLogo(game.homeTeam.abbreviation)}
                        alt={game.homeTeam.name}
                        className="team-logo admin-mini-logo"
                      />
                      <img
                        src={getTeamLogo(game.awayTeam.abbreviation)}
                        alt={game.awayTeam.name}
                        className="team-logo admin-mini-logo"
                      />
                    </div>
                    <div className="team-select-option-copy admin-game-select-copy">
                      <strong>{formatGameLabel(game)}</strong>
                      <span>{formatGameMeta(game)}</span>
                    </div>
                  </button>
                );
              })}
            </AdminSelect>

            <div className="admin-form-grid">
              <label>
                Home Score
                <input
                  type="number"
                  value={gameForm.homeScore}
                  onChange={(event) => setGameForm((old) => ({ ...old, homeScore: event.target.value }))}
                />
              </label>
              <label>
                Away Score
                <input
                  type="number"
                  value={gameForm.awayScore}
                  onChange={(event) => setGameForm((old) => ({ ...old, awayScore: event.target.value }))}
                />
              </label>
              <label>
                Status
                <AdminSelect
                  label={null}
                  open={openPicker === 'status'}
                  onOpenChange={(nextOpen) => setOpenPicker(nextOpen ? 'status' : '')}
                  placeholder="Seleziona stato"
                  triggerContent={
                    <div className="team-select-trigger-main">
                      <div className={`admin-status-badge admin-status-${String(gameForm.status).toLowerCase()}`}>
                        {gameForm.status}
                      </div>
                    </div>
                  }
                  menuClassName="admin-select-menu-compact"
                >
                  {GAME_STATUS_OPTIONS.map((status) => {
                    const isActive = status === gameForm.status;

                    return (
                      <button
                        key={status}
                        type="button"
                        className={`team-select-option admin-status-option${isActive ? ' team-select-option-active' : ''}`}
                        onClick={() => {
                          setGameForm((old) => ({ ...old, status }));
                          setOpenPicker('');
                        }}
                      >
                        <div className={`admin-status-badge admin-status-${status.toLowerCase()}`}>{status}</div>
                      </button>
                    );
                  })}
                </AdminSelect>
              </label>
              <label>
                Arena
                <input
                  value={gameForm.arena}
                  onChange={(event) => setGameForm((old) => ({ ...old, arena: event.target.value }))}
                />
              </label>
              <label>
                Data e ora UTC
                <input
                  type="datetime-local"
                  value={gameForm.datetimeUtc}
                  onChange={(event) => setGameForm((old) => ({ ...old, datetimeUtc: event.target.value }))}
                />
              </label>
            </div>

            <div className="admin-toolbar">
              <div className="helper">
                {selectedGame
                  ? `${selectedGame.homeTeam.name} vs ${selectedGame.awayTeam.name}`
                  : 'Seleziona una partita'}
              </div>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva partita'}
              </button>
            </div>
          </form>
        </article>
      </section>

      {message ? <section className="panel status-box"><p>{message}</p></section> : null}
    </div>
  );
}
