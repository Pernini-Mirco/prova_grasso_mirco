import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import DetailModal from '../components/DetailModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Loader from '../components/Loader.jsx';
import Tooltip from '../components/Tooltip.jsx';
import { getPlayerImage } from '../data/PlayersImages.js';

function formatValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? 'N/D' : `${value}${suffix}`;
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function PlayerSelect({ label, players, value, onChange, open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);
  const selectedPlayer = players.find((player) => String(player.id) === String(value)) ?? null;

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

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

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    if (!normalizedQuery) {
      return players;
    }

    return players.filter((player) => {
      const haystack = [
        player.name,
        player.team?.name,
        player.team?.abbreviation,
        player.position
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [players, search]);

  return (
    <div ref={rootRef} className="team-select player-select">
      <span className="team-select-label">{label}</span>
      <button
        type="button"
        className={`team-select-trigger${open ? ' team-select-trigger-open' : ''}`}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        {selectedPlayer ? (
          <>
            <div className="team-select-trigger-main">
              <img
                src={getPlayerImage(selectedPlayer)}
                alt={selectedPlayer.name}
                className="player-photo player-select-logo"
              />
              <div className="team-select-copy">
                <strong>{selectedPlayer.name}</strong>
                <span>
                  {selectedPlayer.team?.abbreviation || 'N/D'} - {selectedPlayer.position || 'Ruolo n/d'}
                </span>
              </div>
            </div>
            <span className="team-select-caret">{open ? '-' : '+'}</span>
          </>
        ) : (
          <span className="team-select-placeholder">Seleziona giocatore</span>
        )}
      </button>

      {open ? (
        <div className="team-select-menu player-select-menu">
          <div className="player-select-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="player-select-search-input"
              placeholder="Cerca giocatore, team o ruolo"
              aria-label={`Cerca ${label.toLowerCase()}`}
            />
          </div>

          {filteredPlayers.length ? (
            filteredPlayers.map((player) => {
              const isActive = String(player.id) === String(value);

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`team-select-option${isActive ? ' team-select-option-active' : ''}`}
                  onClick={() => {
                    onChange(String(player.id));
                    onOpenChange(false);
                  }}
                >
                  <img
                    src={getPlayerImage(player)}
                    alt={player.name}
                    className="player-photo player-select-logo player-select-option-logo"
                  />
                  <div className="team-select-option-copy">
                    <strong>{player.name}</strong>
                    <span>
                      {player.team?.abbreviation || 'N/D'} - {player.position || 'Ruolo n/d'}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="player-select-empty helper">Nessun giocatore trovato per questa ricerca.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [compareIds, setCompareIds] = useState({ left: '', right: '' });
  const [openComparePicker, setOpenComparePicker] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    api('/api/players')
      .then((items) => {
        setPlayers(items);
        setError('');
      })
      .catch((nextError) => setError(nextError.message));
  }, []);

  useEffect(() => {
    if (!players.length) {
      return;
    }

    const rankedPlayers = [...players].sort(
      (a, b) => safeNumber(b.pointsPerGame) - safeNumber(a.pointsPerGame)
    );

    setCompareIds((current) => ({
      left: current.left || String(rankedPlayers[0]?.id || ''),
      right:
        current.right ||
        String(
          rankedPlayers.find((player) => String(player.id) !== String(rankedPlayers[0]?.id))?.id ||
            rankedPlayers[0]?.id ||
            ''
        )
    }));
  }, [players]);

  useEffect(() => {
    if (!players.length) {
      return;
    }

    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return;
    }

    const match = players.find((player) => String(player.id) === String(playerId));

    if (match) {
      setSelectedPlayer(match);
    }
  }, [players, searchParams]);

  const filtered = useMemo(() => {
    return players
      .filter((player) => player.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.pointsPerGame ?? -1) - Number(a.pointsPerGame ?? -1));
  }, [players, query]);

  const compareLeft = players.find((player) => String(player.id) === String(compareIds.left)) ?? null;
  const compareRight = players.find((player) => String(player.id) === String(compareIds.right)) ?? null;

  const comparisonRows =
    compareLeft && compareRight
      ? [
          {
            label: 'PPG',
            description: 'Punti per gara',
            left: compareLeft.pointsPerGame,
            right: compareRight.pointsPerGame
          },
          {
            label: 'RPG',
            description: 'Rimbalzi per gara',
            left: compareLeft.reboundsPerGame,
            right: compareRight.reboundsPerGame
          },
          {
            label: 'APG',
            description: 'Assist per gara',
            left: compareLeft.assistsPerGame,
            right: compareRight.assistsPerGame
          },
          {
            label: 'EFF',
            description: 'Indice sintetico di efficienza',
            left: compareLeft.efficiency,
            right: compareRight.efficiency
          },
          {
            label: 'ETA',
            description: 'Eta anagrafica',
            left: compareLeft.age,
            right: compareRight.age
          }
        ]
      : [];

  function setComparePlayer(side, nextId) {
    setCompareIds((current) => {
      const oppositeSide = side === 'left' ? 'right' : 'left';
      const updated = { ...current, [side]: nextId };

      if (String(updated.left) === String(updated.right)) {
        const fallback = players.find((player) => String(player.id) !== String(nextId));

        if (fallback) {
          updated[oppositeSide] = String(fallback.id);
        }
      }

      return updated;
    });
  }

  function openPlayer(player) {
    setSelectedPlayer(player);
    setSearchParams({ playerId: String(player.id) }, { replace: true });
  }

  function closePlayer() {
    setSelectedPlayer(null);
    setSearchParams({}, { replace: true });
  }

  if (error) return <div className="panel state-box">{error}</div>;
  if (!players.length) return <Loader variant="table" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Players"
        title="Giocatori"
        subtitle="Profili individuali, confronto diretto e metriche chiave in un'unica vista."
        actions={
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca giocatore"
          />
        }
      />

      <section className="panel comparison-panel">
        <div className="panel-head comparison-panel-head">
          <div>
            <p className="mini-label">Confronto giocatori</p>
            <h3>Head to head</h3>
          </div>
          <p className="helper">
            Confronta due profili con lo stesso linguaggio premium delle altre control room del sito.
          </p>
        </div>

        <div className="comparison-command">
          <PlayerSelect
            label="Player A"
            players={players}
            value={compareIds.left}
            open={openComparePicker === 'left'}
            onOpenChange={(openNext) => setOpenComparePicker(openNext ? 'left' : '')}
            onChange={(nextId) => setComparePlayer('left', nextId)}
          />

          <div className="comparison-versus-core">
            <span className="mini-label">Analyst view</span>
            <strong>VS</strong>
            <p>Selezione rapida con foto, team e ruolo per un confronto piu leggibile.</p>
          </div>

          <PlayerSelect
            label="Player B"
            players={players}
            value={compareIds.right}
            open={openComparePicker === 'right'}
            onOpenChange={(openNext) => setOpenComparePicker(openNext ? 'right' : '')}
            onChange={(nextId) => setComparePlayer('right', nextId)}
          />
        </div>

        {compareLeft && compareRight ? (
          <>
            <div className="comparison-card-grid">
              {[compareLeft, compareRight].map((player) => (
                <article key={player.id} className="comparison-card">
                  <div className="comparison-card-top">
                    <img
                      src={getPlayerImage(player)}
                      alt={player.name}
                      className="player-photo comparison-avatar"
                    />
                    <div>
                      <strong>{player.name}</strong>
                      <p>{player.team?.name || 'Team non disponibile'} - {player.position || 'N/D'}</p>
                    </div>
                  </div>
                  <div className="comparison-badges">
                    <span>{formatValue(player.pointsPerGame)} PPG</span>
                    <span>{formatValue(player.efficiency)} EFF</span>
                    <span>{player.age ? `${player.age} anni` : 'Eta n/d'}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="comparison-stats">
              {comparisonRows.map((row) => {
                const leftValue = safeNumber(row.left);
                const rightValue = safeNumber(row.right);
                const total = leftValue + rightValue || 1;
                const leftWidth = Math.max((leftValue / total) * 100, 10);
                const rightWidth = Math.max((rightValue / total) * 100, 10);

                return (
                  <div key={row.label} className="comparison-row">
                    <div className="comparison-side">
                      <strong>{formatValue(row.left)}</strong>
                      <span>{compareLeft.name}</span>
                    </div>
                    <div className="comparison-center">
                      <Tooltip content={row.description}>
                        <span>{row.label}</span>
                      </Tooltip>
                      <div className="comparison-meter">
                        <div className="comparison-meter-left" style={{ width: `${leftWidth}%` }} />
                        <div className="comparison-meter-right" style={{ width: `${rightWidth}%` }} />
                      </div>
                    </div>
                    <div className="comparison-side comparison-side-away">
                      <strong>{formatValue(row.right)}</strong>
                      <span>{compareRight.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>Squadra</th>
                <th>Pos.</th>
                <th>Eta</th>
                <th><Tooltip content="Punti per gara">PPG</Tooltip></th>
                <th><Tooltip content="Rimbalzi per gara">RPG</Tooltip></th>
                <th><Tooltip content="Assist per gara">APG</Tooltip></th>
                <th><Tooltip content="Indice sintetico di efficienza">EFF</Tooltip></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => (
                <tr
                  key={player.id}
                  className="interactive-row"
                  onClick={() => openPlayer(player)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openPlayer(player);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td>
                    <div className="player-cell">
                      <img
                        src={getPlayerImage(player)}
                        alt={player.name}
                        className="player-photo player-list-photo"
                      />
                      <div className="player-cell-copy">
                        <strong>{player.name}</strong>
                        <span>{player.team?.name || 'Team n/d'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{player.team?.abbreviation || 'N/D'}</td>
                  <td>{formatValue(player.position)}</td>
                  <td>{formatValue(player.age)}</td>
                  <td>{formatValue(player.pointsPerGame)}</td>
                  <td>{formatValue(player.reboundsPerGame)}</td>
                  <td>{formatValue(player.assistsPerGame)}</td>
                  <td>{formatValue(player.efficiency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DetailModal
        open={Boolean(selectedPlayer)}
        title={selectedPlayer?.name}
        subtitle={
          selectedPlayer
            ? `${selectedPlayer.team?.name || 'Team non disponibile'} - Ruolo ${selectedPlayer.position || 'N/D'}`
            : ''
        }
        onClose={closePlayer}
      >
        {selectedPlayer ? (
          <div className="detail-stack">
            <div className="detail-hero">
              <div className="detail-hero-media">
                <img
                  src={getPlayerImage(selectedPlayer)}
                  alt={selectedPlayer.name}
                  className="detail-hero-image detail-player-image"
                />
              </div>
              <div className="detail-hero-copy">
                <p className="mini-label">Giocatore</p>
                <h4>{selectedPlayer.name}</h4>
                <p className="helper">
                  {selectedPlayer.team?.name || 'Team non disponibile'} - Ruolo {selectedPlayer.position || 'N/D'}
                </p>
              </div>
            </div>
            <div className="detail-highlight">
              <div>
                <p className="mini-label">Eta</p>
                <h4>{formatValue(selectedPlayer.age)}</h4>
              </div>
              <div>
                <p className="mini-label">Team</p>
                <h4>{selectedPlayer.team?.abbreviation || 'N/D'}</h4>
              </div>
              <div>
                <p className="mini-label">Efficienza</p>
                <h4>{formatValue(selectedPlayer.efficiency)}</h4>
              </div>
            </div>

            <div className="detail-grid">
              <div><span>Punti</span><strong>{formatValue(selectedPlayer.pointsPerGame)}</strong></div>
              <div><span>Rimbalzi</span><strong>{formatValue(selectedPlayer.reboundsPerGame)}</strong></div>
              <div><span>Assist</span><strong>{formatValue(selectedPlayer.assistsPerGame)}</strong></div>
              <div><span>Posizione</span><strong>{formatValue(selectedPlayer.position)}</strong></div>
              <div><span>Squadra</span><strong>{selectedPlayer.team?.name || 'N/D'}</strong></div>
              <div><span>Citta</span><strong>{selectedPlayer.team?.city || 'N/D'}</strong></div>
            </div>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}
