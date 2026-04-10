import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import Loader from '../components/Loader.jsx';
import useAutoRefresh from '../hooks/useAutoRefresh.js';
import { getTeamLogo } from '../data/TeamsLogo.js';

function GameCard({ game, upcoming = false }) {
  return (
    <article className="panel game-card premium-game-card">
      <div className="game-card-topline">
        <p className="mini-label">{game.date}</p>
        <span className="status-pill muted-pill game-arena-pill">
          {game.status || (upcoming ? 'Scheduled' : 'Status n/d')}
          {game.season ? ` / ${game.season}` : ''}
        </span>
      </div>

      <div className="premium-scoreboard">
        <div className="premium-team-line">
          <img
            src={getTeamLogo(game.homeTeam.abbreviation)}
            alt={game.homeTeam.name}
            className="team-logo premium-team-logo"
          />
          <div>
            <span>{game.homeTeam.abbreviation}</span>
            <strong>{game.homeTeam.name}</strong>
          </div>
          <strong>{upcoming ? '-' : (game.homeScore ?? '-')}</strong>
        </div>

        <div className="premium-team-line">
          <img
            src={getTeamLogo(game.awayTeam.abbreviation)}
            alt={game.awayTeam.name}
            className="team-logo premium-team-logo"
          />
          <div>
            <span>{game.awayTeam.abbreviation}</span>
            <strong>{game.awayTeam.name}</strong>
          </div>
          <strong>{upcoming ? '-' : (game.awayScore ?? '-')}</strong>
        </div>
      </div>

      <p className="helper game-card-helper">
        {game.arena || 'Arena n/d'}
        {game.datetimeUtc ? ` / ${game.datetimeUtc}` : ''}
      </p>
    </article>
  );
}

function isSameCalendarDay(value, reference = new Date()) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toDateString() === reference.toDateString();
}

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [limit, setLimit] = useState(20);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  const loadGames = useCallback(async () => {
    try {
      const nextGames = await api('/api/games');
      setGames(nextGames);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  useAutoRefresh(() => {
    void loadGames();
  }, 60000, true);

  const teamOptions = useMemo(() => {
    const map = new Map();

    games.forEach((game) => {
      [game.homeTeam, game.awayTeam].forEach((team) => {
        if (team?.id) {
          map.set(String(team.id), team);
        }
      });
    });

    return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const gameDate = game.datetimeUtc || game.date;
      const inTeam =
        teamFilter === 'all' ||
        String(game.homeTeam.id) === String(teamFilter) ||
        String(game.awayTeam.id) === String(teamFilter);

      if (!inTeam) {
        return false;
      }

      if (statusFilter === 'today') {
        return isSameCalendarDay(gameDate);
      }

      if (statusFilter === 'final') {
        return game.hasResult;
      }

      if (statusFilter === 'upcoming') {
        return !game.hasResult;
      }

      if (statusFilter === 'live') {
        return String(game.status || '').toLowerCase().startsWith('live');
      }

      return true;
    });
  }, [games, statusFilter, teamFilter]);

  const { results, upcoming } = useMemo(() => {
    const completed = filteredGames.filter((game) => game.hasResult);
    const scheduled = filteredGames.filter((game) => !game.hasResult);

    return {
      results: completed.slice(0, limit),
      upcoming: scheduled.slice(0, Math.min(12, Math.max(4, Math.floor(limit / 2))))
    };
  }, [filteredGames, limit]);

  if (error) return <div className="panel state-box">{error}</div>;
  if (!games.length) return <Loader variant="cards" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Games"
        title="Partite"
        subtitle="Calendario operativo, risultati e stato delle gare in una vista continua."
        actions={
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="filter-select">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={40}>40</option>
          </select>
        }
      />

      <section className="panel smart-filter-panel">
        <div className="smart-filter-head">
          <div>
            <p className="mini-label">Smart filters</p>
            <h3>Vista rapida del calendario</h3>
          </div>
          <span className="status-pill muted-pill">{filteredGames.length} gare</span>
        </div>

        <div className="smart-filter-row">
          {[
            ['all', 'Tutte'],
            ['final', 'Finali'],
            ['upcoming', 'Programmate'],
            ['live', 'Live'],
            ['today', 'Oggi']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`smart-filter-chip${statusFilter === value ? ' smart-filter-chip-active' : ''}`}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}

          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="filter-select smart-filter-select"
          >
            <option value="all">Tutte le squadre</option>
            {teamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="page-stack">
        <div>
          <p className="mini-label">Recent Results</p>
          <h3>Ultimi risultati</h3>
        </div>
        {results.length ? (
          <section className="card-grid">
            {results.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </section>
        ) : (
          <div className="panel state-box">Nessun risultato disponibile per i filtri selezionati.</div>
        )}
      </section>

      <section className="page-stack">
        <div>
          <p className="mini-label">Upcoming</p>
          <h3>Prossime partite</h3>
        </div>
        {upcoming.length ? (
          <section className="card-grid">
            {upcoming.map((game) => (
              <GameCard key={game.id} game={game} upcoming />
            ))}
          </section>
        ) : (
          <div className="panel state-box">Nessuna partita programmata per i filtri selezionati.</div>
        )}
      </section>
    </div>
  );
}
