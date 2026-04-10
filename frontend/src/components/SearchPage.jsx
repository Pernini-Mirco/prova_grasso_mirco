import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import PageHeader from './PageHeader.jsx';
import Loader from './Loader.jsx';
import SearchBar from '../pages/SearchBar.jsx';
import { getTeamLogo } from '../data/TeamsLogo.js';
import { getPlayerImage } from '../data/PlayersImages.js';

export default function SearchPage() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/api/teams'), api('/api/players'), api('/api/games')])
      .then(([teamsData, playersData, gamesData]) => {
        setTeams(teamsData);
        setPlayers(playersData);
        setGames(gamesData);
        setError('');
      })
      .catch((nextError) => setError(nextError.message));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!normalizedQuery) return teams.slice(0, 8);

    return teams.filter((team) =>
      `${team.city} ${team.name} ${team.abbreviation} ${team.conference} ${team.division}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [teams, normalizedQuery]);

  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) return players.slice(0, 8);

    return players.filter((player) =>
      `${player.name || ''} ${player.position || ''} ${player.team?.name || ''} ${player.team?.abbreviation || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [players, normalizedQuery]);

  const filteredGames = useMemo(() => {
    if (!normalizedQuery) return games.slice(0, 8);

    return games.filter((game) =>
      `${game.homeTeam?.name || ''} ${game.awayTeam?.name || ''} ${game.status || ''} ${game.date || ''} ${game.arena || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [games, normalizedQuery]);

  const isLoading = !teams.length && !players.length && !games.length;

  if (error) return <div className="panel state-box">{error}</div>;
  if (isLoading) return <Loader />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Search"
        title="Ricerca globale"
        subtitle="Esplora l'intera piattaforma da un unico punto di accesso."
      />

      <div className="panel">
        <SearchBar
          placeholder="Cerca squadre, giocatori o partite..."
          onSearch={setQuery}
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="mini-label">Teams</p>
            <h3>Squadre</h3>
          </div>
        </div>

        <div className="search-results-grid">
          {filteredTeams.length ? (
            filteredTeams.map((team) => (
              <article key={team.id} className="search-card">
                <div className="search-card-head">
                  <img
                    src={getTeamLogo(team.abbreviation)}
                    alt={team.name}
                    className="team-logo"
                  />
                  <div>
                    <p className="mini-label">{team.abbreviation}</p>
                    <h4>{team.name}</h4>
                    <p className="helper">{team.city} - {team.conference}</p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="helper">Nessuna squadra trovata.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="mini-label">Players</p>
            <h3>Giocatori</h3>
          </div>
        </div>

        <div className="search-results-grid">
          {filteredPlayers.length ? (
            filteredPlayers.map((player) => (
              <article key={player.id} className="search-card">
                <div className="search-card-head">
                  <img
                    src={getPlayerImage(player)}
                    alt={player.name || 'Player'}
                    className="player-photo"
                  />
                  <div>
                    <p className="mini-label">{player.position || 'NBA'}</p>
                    <h4>{player.name}</h4>
                    <p className="helper">{player.team?.name || 'Team non disponibile'}</p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="helper">Nessun giocatore trovato.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="mini-label">Games</p>
            <h3>Partite</h3>
          </div>
        </div>

        <div className="search-results-grid">
          {filteredGames.length ? (
            filteredGames.map((game) => (
              <article key={game.id} className="search-card">
                <div className="game-search-line">
                  <div>
                    <p className="mini-label">{game.status || 'Game'}</p>
                    <h4>
                      {game.homeTeam?.name || 'Home'} vs {game.awayTeam?.name || 'Away'}
                    </h4>
                    <p className="helper">{game.date || 'Data non disponibile'}</p>
                  </div>
                  <div className="record-pill">
                    {game.homeScore ?? '-'} - {game.awayScore ?? '-'}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="helper">Nessuna partita trovata.</p>
          )}
        </div>
      </section>
    </div>
  );
}
