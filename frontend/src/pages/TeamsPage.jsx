import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import DetailModal from '../components/DetailModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Loader from '../components/Loader.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { getTeamLogo } from '../data/TeamsLogo.js';
import SearchBar from './SearchBar.jsx';

function formatValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? 'N/D' : `${value}${suffix}`;
}

function getGameTimestamp(game) {
  const value = game.datetimeUtc || game.date;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [conference, setConference] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    Promise.all([api('/api/teams'), api('/api/games')])
      .then(([teamItems, gameItems]) => {
        setTeams(teamItems);
        setGames(gameItems);
        setError('');
      })
      .catch((nextError) => setError(nextError.message));
  }, []);

  useEffect(() => {
    if (!teams.length) {
      return;
    }

    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return;
    }

    const match = teams.find((team) => String(team.id) === String(teamId));

    if (match) {
      setSelectedTeam(match);
    }
  }, [teams, searchParams]);

  const filtered = useMemo(() => {
    return teams
      .filter((team) => conference === 'All' || team.conference === conference)
      .filter((team) =>
        `${team.city} ${team.name} ${team.abbreviation}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) => Number(b.stats?.winPct ?? -1) - Number(a.stats?.winPct ?? -1));
  }, [teams, conference, search]);

  const timelineByTeam = useMemo(() => {
    const map = new Map();
    const completedGames = [...games]
      .filter((game) => game.hasResult)
      .sort((a, b) => getGameTimestamp(b) - getGameTimestamp(a));

    completedGames.forEach((game) => {
      const homeTeamId = String(game.homeTeam.id);
      const awayTeamId = String(game.awayTeam.id);

      [
        {
          teamId: homeTeamId,
          opponent: game.awayTeam,
          result: (game.homeScore ?? 0) >= (game.awayScore ?? 0) ? 'W' : 'L',
          score: `${game.homeScore ?? '-'}-${game.awayScore ?? '-'}`,
          venue: 'vs'
        },
        {
          teamId: awayTeamId,
          opponent: game.homeTeam,
          result: (game.awayScore ?? 0) >= (game.homeScore ?? 0) ? 'W' : 'L',
          score: `${game.awayScore ?? '-'}-${game.homeScore ?? '-'}`,
          venue: '@'
        }
      ].forEach((entry) => {
        const existing = map.get(entry.teamId) || [];

        if (existing.length < 5) {
          existing.push({
            id: game.id,
            date: game.date,
            result: entry.result,
            score: entry.score,
            opponentName: entry.opponent.name,
            opponentAbbreviation: entry.opponent.abbreviation,
            venue: entry.venue
          });
          map.set(entry.teamId, existing);
        }
      });
    });

    return map;
  }, [games]);

  function openTeam(team) {
    setSelectedTeam(team);
    setSearchParams({ teamId: String(team.id) }, { replace: true });
  }

  function closeTeam() {
    setSelectedTeam(null);
    setSearchParams({}, { replace: true });
  }

  if (error) return <div className="panel state-box">{error}</div>;
  if (!teams.length) return <Loader variant="cards" />;

  const selectedTimeline = selectedTeam ? timelineByTeam.get(String(selectedTeam.id)) || [] : [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Teams"
        title="Franchigie NBA"
        subtitle="Panoramica completa delle franchigie, tra struttura, rendimento e trend recenti."
        actions={
          <select
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            className="filter-select"
          >
            <option value="All">Tutte</option>
            <option value="East">Eastern Conference</option>
            <option value="West">Western Conference</option>
          </select>
        }
      />

      <SearchBar
        placeholder="Cerca squadra, citta o sigla..."
        onSearch={setSearch}
      />

      <section className="card-grid">
        {filtered.map((team) => {
          const teamTimeline = timelineByTeam.get(String(team.id)) || [];

          return (
            <article
              key={team.id}
              className="panel team-card interactive-card"
              onClick={() => openTeam(team)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openTeam(team);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="team-row">
                <div className="team-row-main">
                  <img
                    src={getTeamLogo(team.abbreviation)}
                    alt={team.name}
                    className="team-logo team-list-logo"
                  />
                  <div>
                    <p className="mini-label">{team.abbreviation}</p>
                    <h3>{team.name}</h3>
                    <p className="helper">
                      {team.city} • {team.division}
                    </p>
                  </div>
                </div>
                <div className="team-card-side">
                  <span className="record-pill">
                    {formatValue(team.stats?.wins)}-{formatValue(team.stats?.losses)}
                  </span>
                </div>
              </div>

              <div className="team-stats">
                <span>
                  <Tooltip content="Percentuale vittorie">Win%</Tooltip>
                  <strong>{formatValue(team.stats?.winPct)}</strong>
                </span>
                <span>
                  <Tooltip content="Punti per gara">PPG</Tooltip>
                  <strong>{formatValue(team.stats?.pointsPerGame)}</strong>
                </span>
                <span>
                  <Tooltip content="Rimbalzi per gara">RPG</Tooltip>
                  <strong>{formatValue(team.stats?.reboundsPerGame)}</strong>
                </span>
                <span>
                  <Tooltip content="Assist per gara">APG</Tooltip>
                  <strong>{formatValue(team.stats?.assistsPerGame)}</strong>
                </span>
              </div>

              <div className="team-timeline-strip">
                {teamTimeline.slice(0, 3).map((item) => (
                  <span
                    key={`${team.id}-${item.id}`}
                    className={`timeline-pill ${item.result === 'W' ? 'timeline-pill-win' : 'timeline-pill-loss'}`}
                  >
                    {item.result} {item.venue} {item.opponentAbbreviation}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <DetailModal
        open={Boolean(selectedTeam)}
        title={selectedTeam?.name}
        subtitle={
          selectedTeam
            ? `${selectedTeam.city} • ${selectedTeam.conference} Conference • ${selectedTeam.division}`
            : ''
        }
        onClose={closeTeam}
      >
        {selectedTeam ? (
          <div className="detail-stack">
            <div className="detail-hero">
              <div className="detail-hero-media">
                <img
                  src={getTeamLogo(selectedTeam.abbreviation)}
                  alt={selectedTeam.name}
                  className="detail-hero-image detail-team-image"
                />
              </div>
              <div className="detail-hero-copy">
                <p className="mini-label">Franchigia</p>
                <h4>{selectedTeam.name}</h4>
                <p className="helper">
                  {selectedTeam.city} • {selectedTeam.conference} Conference
                </p>
              </div>
            </div>
            <div className="detail-highlight">
              <div>
                <p className="mini-label">Record</p>
                <h4>{formatValue(selectedTeam.stats?.wins)}-{formatValue(selectedTeam.stats?.losses)}</h4>
              </div>
              <div>
                <p className="mini-label">Sigla</p>
                <h4>{selectedTeam.abbreviation}</h4>
              </div>
              <div>
                <p className="mini-label">Forma recente</p>
                <h4>{selectedTeam.stats?.recentForm ? `${(selectedTeam.stats.recentForm * 100).toFixed(0)}%` : 'N/D'}</h4>
              </div>
            </div>

            <div className="detail-grid">
              <div><span>Win%</span><strong>{formatValue(selectedTeam.stats?.winPct)}</strong></div>
              <div><span>Punti segnati</span><strong>{formatValue(selectedTeam.stats?.pointsPerGame)}</strong></div>
              <div><span>Punti concessi</span><strong>{formatValue(selectedTeam.stats?.pointsAllowedPerGame)}</strong></div>
              <div><span>Rimbalzi</span><strong>{formatValue(selectedTeam.stats?.reboundsPerGame)}</strong></div>
              <div><span>Assist</span><strong>{formatValue(selectedTeam.stats?.assistsPerGame)}</strong></div>
              <div><span>Citta</span><strong>{selectedTeam.city}</strong></div>
            </div>

            <div className="timeline-panel">
              <div className="panel-head">
                <h3>Mini timeline</h3>
                <span className="mini-link">Ultime 5 gare</span>
              </div>
              {selectedTimeline.length ? (
                <div className="timeline-list">
                  {selectedTimeline.map((item) => (
                    <div key={item.id} className="timeline-row">
                      <span className={`timeline-dot ${item.result === 'W' ? 'timeline-dot-win' : 'timeline-dot-loss'}`}>
                        {item.result}
                      </span>
                      <div className="timeline-copy">
                        <strong>{item.venue} {item.opponentName}</strong>
                        <span>{item.date} • {item.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="state-box">Nessuna gara recente disponibile per questa franchigia.</div>
              )}
            </div>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}
