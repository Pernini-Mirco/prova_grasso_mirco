import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import Loader from '../components/Loader.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Tooltip from '../components/Tooltip.jsx';
import useAutoRefresh from '../hooks/useAutoRefresh.js';
import { getTeamLogo } from '../data/TeamsLogo.js';

function formatPredictionValue(value, suffix = '') {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? 'N/D' : `${value}${suffix}`;
}

function safeMetric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatRecord(team) {
  if (!team?.stats) {
    return 'N/D';
  }

  return `${team.stats.wins}-${team.stats.losses}`;
}

function formatForm(team) {
  if (!team?.stats || !Number.isFinite(Number(team.stats.recentForm))) {
    return 'N/D';
  }

  return `${Math.round(Number(team.stats.recentForm) * 100)}%`;
}

function getConfidenceMeta(gap) {
  const score = Math.min(100, Math.round(30 + gap * 2.6));

  if (score >= 78) {
    return {
      score,
      label: 'Alta',
      helper: 'Il modello vede un vantaggio netto e abbastanza stabile.',
      tone: 'high'
    };
  }

  if (score >= 58) {
    return {
      score,
      label: 'Media',
      helper: 'Esiste una favorita, ma il matchup resta ancora aperto.',
      tone: 'medium'
    };
  }

  return {
    score,
    label: 'Bassa',
    helper: 'Scenario molto equilibrato, con esito piu volatile.',
    tone: 'low'
  };
}

function formatDateLabel(value) {
  if (!value) {
    return 'Data n/d';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Data n/d';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short'
  }).format(parsed);
}

function parseExpectedScore(expectedScore) {
  const [homeScore = 'N/D', awayScore = 'N/D'] = String(expectedScore || '')
    .split('-')
    .map((part) => part.trim());

  return { homeScore, awayScore };
}

function sortGamesByDateDesc(left, right) {
  const leftValue = new Date(left.datetimeUtc || left.date || 0).getTime();
  const rightValue = new Date(right.datetimeUtc || right.date || 0).getTime();
  return rightValue - leftValue;
}

function getRecentTeamGames(games, teamId, limit) {
  return games
    .filter((game) => game.hasResult)
    .filter(
      (game) =>
        String(game.homeTeamId) === String(teamId) || String(game.awayTeamId) === String(teamId)
    )
    .sort(sortGamesByDateDesc)
    .slice(0, limit);
}

function getHeadToHeadGames(games, homeTeamId, awayTeamId, limit) {
  return games
    .filter((game) => game.hasResult)
    .filter((game) => {
      const sameDirection =
        String(game.homeTeamId) === String(homeTeamId) &&
        String(game.awayTeamId) === String(awayTeamId);
      const oppositeDirection =
        String(game.homeTeamId) === String(awayTeamId) &&
        String(game.awayTeamId) === String(homeTeamId);
      return sameDirection || oppositeDirection;
    })
    .sort(sortGamesByDateDesc)
    .slice(0, limit);
}

function summarizeRecentRecord(games, teamId) {
  if (!games.length) {
    return 'N/D';
  }

  const wins = games.filter((game) => didTeamWin(game, teamId)).length;
  return `${wins}W - ${games.length - wins}L`;
}

function getOpponent(game, teamId) {
  return String(game.homeTeamId) === String(teamId) ? game.awayTeam : game.homeTeam;
}

function didTeamWin(game, teamId) {
  if (!game.hasResult) {
    return false;
  }

  const isHome = String(game.homeTeamId) === String(teamId);
  const teamScore = isHome ? Number(game.homeScore) : Number(game.awayScore);
  const opponentScore = isHome ? Number(game.awayScore) : Number(game.homeScore);
  return teamScore >= opponentScore;
}

function getTeamGameScoreline(game, teamId) {
  const isHome = String(game.homeTeamId) === String(teamId);
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  return `${teamScore} - ${opponentScore}`;
}

function buildTrendSeriesFromGames(games, teamId) {
  return [...games]
    .slice()
    .reverse()
    .map((game) => {
      const isHome = String(game.homeTeamId) === String(teamId);
      const teamScore = Number(isHome ? game.homeScore : game.awayScore);
      const opponentScore = Number(isHome ? game.awayScore : game.homeScore);
      return teamScore - opponentScore;
    });
}

function TeamSelect({ label, teams, value, onChange, open, onToggle }) {
  const rootRef = useRef(null);
  const selectedTeam = teams.find((team) => String(team.id) === String(value)) ?? null;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        onToggle(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onToggle(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onToggle]);

  return (
    <div ref={rootRef} className="team-select">
      <span className="team-select-label">{label}</span>
      <button
        type="button"
        className={`team-select-trigger${open ? ' team-select-trigger-open' : ''}`}
        onClick={() => onToggle(!open)}
        aria-expanded={open}
      >
        {selectedTeam ? (
          <>
            <div className="team-select-trigger-main">
              <img
                src={getTeamLogo(selectedTeam.abbreviation)}
                alt={selectedTeam.name}
                className="team-logo team-select-logo"
              />
              <div className="team-select-copy">
                <strong>{selectedTeam.name}</strong>
                <span>{selectedTeam.abbreviation} - {selectedTeam.conference}</span>
              </div>
            </div>
            <span className="team-select-caret">{open ? '-' : '+'}</span>
          </>
        ) : (
          <span className="team-select-placeholder">Seleziona squadra</span>
        )}
      </button>

      {open ? (
        <div className="team-select-menu">
          {teams.map((team) => {
            const isActive = String(team.id) === String(value);

            return (
              <button
                  key={team.id}
                  type="button"
                  className={`team-select-option${isActive ? ' team-select-option-active' : ''}`}
                  onClick={() => {
                    onChange(String(team.id));
                    onToggle(false);
                  }}
                >
                <img
                  src={getTeamLogo(team.abbreviation)}
                  alt={team.name}
                  className="team-logo team-select-option-logo"
                />
                <div className="team-select-option-copy">
                  <strong>{team.name}</strong>
                  <span>{team.abbreviation} - {team.city}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PredictionGameList({ title, games, focusTeamId, emptyMessage }) {
  return (
    <div className="prediction-context-column">
      <div className="prediction-context-head">
        <p className="mini-label">{title}</p>
      </div>

      {games.length ? (
        <div className="prediction-context-list">
          {games.map((game) => {
            const opponent = getOpponent(game, focusTeamId);
            const won = didTeamWin(game, focusTeamId);

            return (
              <article key={game.id} className="prediction-context-item">
                <div className={`prediction-context-outcome${won ? ' prediction-context-outcome-win' : ' prediction-context-outcome-loss'}`}>
                  {won ? 'W' : 'L'}
                </div>
                <div className="prediction-context-copy">
                  <strong>
                    vs {opponent?.abbreviation || 'N/D'} - {getTeamGameScoreline(game, focusTeamId)}
                  </strong>
                  <span>{formatDateLabel(game.datetimeUtc || game.date)} - {game.arena || 'Arena n/d'}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="helper">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [form, setForm] = useState({ homeTeamId: '2', awayTeamId: '17' });
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(true);
  const [refreshingPrediction, setRefreshingPrediction] = useState(false);
  const [openPicker, setOpenPicker] = useState('');

  const loadPredictionContext = useCallback(async () => {
    try {
      const [teamItems, gameItems] = await Promise.all([api('/api/teams'), api('/api/games')]);

      setTeams(teamItems);
      setGames(gameItems);
      setForm((current) => {
        const hasHome = teamItems.some((team) => String(team.id) === String(current.homeTeamId));
        const hasAway = teamItems.some((team) => String(team.id) === String(current.awayTeamId));

        if (hasHome && hasAway && current.homeTeamId !== current.awayTeamId) {
          return current;
        }

        return {
          homeTeamId: String(teamItems[1]?.id || teamItems[0]?.id || ''),
          awayTeamId: String(teamItems[16]?.id || teamItems[0]?.id || '')
        };
      });

      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrediction = useCallback(async (silent = false) => {
    if (!form.homeTeamId || !form.awayTeamId || form.homeTeamId === form.awayTeamId) {
      return;
    }

    if (silent) {
      setRefreshingPrediction(true);
    } else {
      setLoadingPrediction(true);
    }

    try {
      const data = await api(`/api/predictions?homeTeamId=${form.homeTeamId}&awayTeamId=${form.awayTeamId}`);
      setPrediction(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (silent) {
        setRefreshingPrediction(false);
      } else {
        setLoadingPrediction(false);
      }
    }
  }, [form]);

  useEffect(() => {
    void loadPredictionContext();
  }, [loadPredictionContext]);

  useEffect(() => {
    void loadPrediction();
  }, [loadPrediction]);

  useAutoRefresh(() => {
    void loadPredictionContext();
    void loadPrediction(true);
  }, 60000, !loading);

  if (loading) return <Loader variant="prediction" />;
  if (!teams.length) return <div className="panel state-box">Nessuna squadra disponibile.</div>;

  const homeTeam = teams.find((team) => String(team.id) === form.homeTeamId) ?? null;
  const awayTeam = teams.find((team) => String(team.id) === form.awayTeamId) ?? null;
  const favoriteTeam =
    prediction && prediction.homeWinProbability >= prediction.awayWinProbability
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const favoriteProbability = prediction
    ? Math.max(prediction.homeWinProbability, prediction.awayWinProbability)
    : null;
  const offenseLeader =
    prediction && prediction.modelInputs.home.pointsPerGame >= prediction.modelInputs.away.pointsPerGame
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const formLeader =
    prediction && prediction.modelInputs.home.recentForm >= prediction.modelInputs.away.recentForm
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const defenseLeader =
    prediction &&
    prediction.modelInputs.home.pointsAllowedPerGame <= prediction.modelInputs.away.pointsAllowedPerGame
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const reboundLeader =
    prediction && prediction.modelInputs.home.reboundsPerGame >= prediction.modelInputs.away.reboundsPerGame
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const playmakingLeader =
    prediction && prediction.modelInputs.home.assistsPerGame >= prediction.modelInputs.away.assistsPerGame
      ? prediction.homeTeam
      : prediction?.awayTeam;
  const probabilityGap = prediction
    ? Math.abs(prediction.homeWinProbability - prediction.awayWinProbability)
    : 0;
  const confidence = getConfidenceMeta(probabilityGap);
  const { homeScore: expectedHomeScore, awayScore: expectedAwayScore } = parseExpectedScore(
    prediction?.expectedScore
  );
  const statRows = prediction
    ? [
        {
          label: 'Points per game',
          tooltip: 'Volume offensivo medio della squadra.',
          homeValue: prediction.modelInputs.home.pointsPerGame,
          awayValue: prediction.modelInputs.away.pointsPerGame,
          format: (value) => formatPredictionValue(value, ' PPG')
        },
        {
          label: 'Points allowed',
          tooltip: 'Punti concessi di media. Meno e meglio.',
          homeValue: prediction.modelInputs.home.pointsAllowedPerGame,
          awayValue: prediction.modelInputs.away.pointsAllowedPerGame,
          format: (value) => formatPredictionValue(value, ' PA')
        },
        {
          label: 'Rebounds',
          tooltip: 'Controllo del possesso e fisicita a rimbalzo.',
          homeValue: prediction.modelInputs.home.reboundsPerGame,
          awayValue: prediction.modelInputs.away.reboundsPerGame,
          format: (value) => formatPredictionValue(value, ' RPG')
        },
        {
          label: 'Assists',
          tooltip: 'Qualita della circolazione di palla.',
          homeValue: prediction.modelInputs.home.assistsPerGame,
          awayValue: prediction.modelInputs.away.assistsPerGame,
          format: (value) => formatPredictionValue(value, ' APG')
        },
        {
          label: 'Recent form',
          tooltip: 'Forma recente espressa in percentuale.',
          homeValue: Number((prediction.modelInputs.home.recentForm * 100).toFixed(0)),
          awayValue: Number((prediction.modelInputs.away.recentForm * 100).toFixed(0)),
          format: (value) => formatPredictionValue(value, '%')
        }
      ]
    : [];
  const driverCards = prediction
    ? [
        {
          label: 'Scoring edge',
          team: offenseLeader,
          value: `${Math.abs(
            safeMetric(prediction.modelInputs.home.pointsPerGame) -
              safeMetric(prediction.modelInputs.away.pointsPerGame)
          ).toFixed(1)} PPG`,
          note: 'Volume offensivo medio'
        },
        {
          label: 'Defensive edge',
          team: defenseLeader,
          value: `${Math.abs(
            safeMetric(prediction.modelInputs.home.pointsAllowedPerGame) -
              safeMetric(prediction.modelInputs.away.pointsAllowedPerGame)
          ).toFixed(1)} PA`,
          note: 'Minor concessione punti'
        },
        {
          label: 'Glass edge',
          team: reboundLeader,
          value: `${Math.abs(
            safeMetric(prediction.modelInputs.home.reboundsPerGame) -
              safeMetric(prediction.modelInputs.away.reboundsPerGame)
          ).toFixed(1)} RPG`,
          note: 'Controllo del rimbalzo'
        },
        {
          label: 'Playmaking edge',
          team: playmakingLeader,
          value: `${Math.abs(
            safeMetric(prediction.modelInputs.home.assistsPerGame) -
              safeMetric(prediction.modelInputs.away.assistsPerGame)
          ).toFixed(1)} APG`,
          note: 'Movimento palla'
        },
        {
          label: 'Momentum',
          team: formLeader,
          value: `${Math.abs(
            Math.round(safeMetric(prediction.modelInputs.home.recentForm) * 100) -
              Math.round(safeMetric(prediction.modelInputs.away.recentForm) * 100)
          )}%`,
          note: 'Tendenza recente'
        }
      ]
    : [];
  const homeRecentFive = prediction ? getRecentTeamGames(games, prediction.homeTeam.id, 5) : [];
  const awayRecentFive = prediction ? getRecentTeamGames(games, prediction.awayTeam.id, 5) : [];
  const homeTrendSeries = prediction ? buildTrendSeriesFromGames(homeRecentFive, prediction.homeTeam.id) : [];
  const awayTrendSeries = prediction ? buildTrendSeriesFromGames(awayRecentFive, prediction.awayTeam.id) : [];
  const recentHeadToHead = prediction
    ? getHeadToHeadGames(games, prediction.homeTeam.id, prediction.awayTeam.id, 4)
    : [];
  const stageSignals = [
    {
      label: 'Record casa',
      value: formatRecord(homeTeam),
      detail: homeTeam?.conference || 'Conference n/d',
      trend: homeTrendSeries
    },
    {
      label: 'Record ospite',
      value: formatRecord(awayTeam),
      detail: awayTeam?.conference || 'Conference n/d',
      trend: awayTrendSeries
    },
    {
      label: 'Form casa',
      value: formatForm(homeTeam),
      detail: 'Ultimo snapshot',
      trend: homeTrendSeries
    },
    {
      label: 'Form ospite',
      value: formatForm(awayTeam),
      detail: 'Ultimo snapshot',
      trend: awayTrendSeries
    }
  ];

  function swapTeams() {
    setOpenPicker('');
    setForm((current) => ({
      homeTeamId: current.awayTeamId,
      awayTeamId: current.homeTeamId
    }));
  }

  function randomizeMatchup() {
    if (teams.length < 2) {
      return;
    }

    const homeIndex = Math.floor(Math.random() * teams.length);
    let awayIndex = Math.floor(Math.random() * teams.length);

    while (awayIndex === homeIndex) {
      awayIndex = Math.floor(Math.random() * teams.length);
    }

    setOpenPicker('');
    setForm({
      homeTeamId: String(teams[homeIndex].id),
      awayTeamId: String(teams[awayIndex].id)
    });
  }

  return (
    <div className="page-stack prediction-room">
      <PageHeader
        eyebrow="Prediction Lab"
        title="Matchup Intelligence Center"
        subtitle="Scenario room per valutare matchup, probabilita e segnali decisionali."
      />

      <section className="panel prediction-stage-card">
        <div className="prediction-stage-head">
          <div>
            <p className="mini-label">Control room</p>
            <h3>Imposta il matchup centrale</h3>
          </div>
          <span className={`prediction-status-chip${refreshingPrediction ? ' prediction-status-chip-refreshing' : ''}`}>
            {loadingPrediction ? 'Model running' : refreshingPrediction ? 'Refreshing...' : 'Auto refresh 60s'}
          </span>
        </div>

        <div className="prediction-stage-grid">
          <TeamSelect
            label="Squadra di casa"
            teams={teams}
            value={form.homeTeamId}
            open={openPicker === 'home'}
            onToggle={(openNext) => setOpenPicker(openNext ? 'home' : '')}
            onChange={(value) => setForm((current) => ({ ...current, homeTeamId: value }))}
          />

          <div className={`prediction-stage-core${refreshingPrediction ? ' prediction-stage-core-pulse' : ''}`}>
            <div className="prediction-stage-core-team">
              {homeTeam ? (
                <>
                  <img
                    src={getTeamLogo(homeTeam.abbreviation)}
                    alt={homeTeam.name}
                    className="team-logo prediction-stage-core-logo"
                  />
                  <span>{homeTeam.abbreviation}</span>
                </>
              ) : (
                <span>HOME</span>
              )}
            </div>

            <div className="prediction-stage-core-center">
              <span className="mini-label">Matchup center</span>
              <strong>
                {homeTeam?.abbreviation || 'HOME'} <span>VS</span> {awayTeam?.abbreviation || 'AWAY'}
              </strong>
              <p>
                {prediction ? prediction.edgeDescription : 'Seleziona due squadre per attivare la lettura completa.'}
              </p>
            </div>

            <div className="prediction-stage-core-team">
              {awayTeam ? (
                <>
                  <img
                    src={getTeamLogo(awayTeam.abbreviation)}
                    alt={awayTeam.name}
                    className="team-logo prediction-stage-core-logo"
                  />
                  <span>{awayTeam.abbreviation}</span>
                </>
              ) : (
                <span>AWAY</span>
              )}
            </div>
          </div>

          <TeamSelect
            label="Squadra ospite"
            teams={teams}
            value={form.awayTeamId}
            open={openPicker === 'away'}
            onToggle={(openNext) => setOpenPicker(openNext ? 'away' : '')}
            onChange={(value) => setForm((current) => ({ ...current, awayTeamId: value }))}
          />
        </div>

        <div className="prediction-action-row">
          <button type="button" className="secondary-button" onClick={swapTeams}>
            Inverti matchup
          </button>
          <button type="button" className="secondary-button" onClick={randomizeMatchup}>
            Matchup casuale
          </button>
        </div>

        <div className="prediction-stage-footer">
          {stageSignals.map((signal) => (
            <article key={signal.label} className="prediction-stage-signal">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
              {signal.trend?.length ? (
                <div className="prediction-stage-trend">
                  <Sparkline data={signal.trend} tone="neutral" label={`${signal.label} trend`} />
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {form.homeTeamId === form.awayTeamId ? (
          <p className="helper">Seleziona due squadre diverse.</p>
        ) : null}
        {error ? <p className="helper">{error}</p> : null}
      </section>

      {prediction && !loadingPrediction ? (
        <>
          <section className="prediction-results-grid" key={`${form.homeTeamId}-${form.awayTeamId}-${prediction.expectedScore}`}>
            <article className="panel prediction-outcome-card prediction-motion-card">
              <div className="prediction-outcome-head">
                <div>
                  <p className="mini-label">Projected outcome</p>
                  <h3>{prediction.homeTeam.name} vs {prediction.awayTeam.name}</h3>
                </div>
                <span className="prediction-outcome-badge">{favoriteTeam?.abbreviation} lead</span>
              </div>

              <div className="prediction-outcome-scoreboard">
                <div className="prediction-outcome-team">
                  <img
                    src={getTeamLogo(prediction.homeTeam.abbreviation)}
                    alt={prediction.homeTeam.name}
                    className="team-logo prediction-team-logo"
                  />
                  <strong>{prediction.homeTeam.abbreviation}</strong>
                  <span>{prediction.homeWinProbability}% win</span>
                </div>
                <div className="prediction-outcome-center">
                  <span>Projected score</span>
                  <strong>{expectedHomeScore} - {expectedAwayScore}</strong>
                  <p>{prediction.edgeDescription}</p>
                </div>
                <div className="prediction-outcome-team">
                  <img
                    src={getTeamLogo(prediction.awayTeam.abbreviation)}
                    alt={prediction.awayTeam.name}
                    className="team-logo prediction-team-logo"
                  />
                  <strong>{prediction.awayTeam.abbreviation}</strong>
                  <span>{prediction.awayWinProbability}% win</span>
                </div>
              </div>
            </article>

            <article className={`panel prediction-confidence-card prediction-confidence-${confidence.tone} prediction-motion-card`}>
              <div className="prediction-confidence-copy">
                <Tooltip content="Misura quanto il modello vede un vantaggio netto, basato sul divario tra le due probabilita.">
                  <span className="prediction-confidence-label">Prediction confidence</span>
                </Tooltip>
                <strong>{confidence.score}/100</strong>
                <p>{confidence.label} confidence - gap di {probabilityGap} punti percentuali</p>
                <span>{confidence.helper}</span>
              </div>
              <div className="prediction-confidence-meter">
                <div className="prediction-confidence-rail">
                  <div style={{ width: `${confidence.score}%` }} />
                </div>
              </div>
            </article>

            <article className="panel prediction-recommendation-card prediction-motion-card">
              <p className="mini-label">Analyst summary</p>
              <h3>{favoriteTeam?.name || 'N/D'}</h3>
              <strong>{favoriteProbability}% probabilita</strong>
              <p>
                Home court bonus incluso nel modello, con focus su scoring, playmaking, rimbalzi e forma recente.
              </p>
              <div className="prediction-summary-pills">
                <span>{prediction.homeTeam.abbreviation} ultimi 5: {summarizeRecentRecord(homeRecentFive, prediction.homeTeam.id)}</span>
                <span>{prediction.awayTeam.abbreviation} ultimi 5: {summarizeRecentRecord(awayRecentFive, prediction.awayTeam.id)}</span>
              </div>
            </article>
          </section>

          <section className="prediction-kpi-grid prediction-kpi-grid-wide">
            <div className="prediction-kpi-card">
              <Tooltip content="Probabilita stimata di vittoria della squadra di casa.">
                <span>Home win</span>
              </Tooltip>
              <strong>{prediction.homeWinProbability}%</strong>
              <div className="probability-rail">
                <div style={{ width: `${prediction.homeWinProbability}%` }} />
              </div>
            </div>
            <div className="prediction-kpi-card">
              <Tooltip content="Probabilita stimata di vittoria della squadra ospite.">
                <span>Away win</span>
              </Tooltip>
              <strong>{prediction.awayWinProbability}%</strong>
              <div className="probability-rail probability-rail-away">
                <div style={{ width: `${prediction.awayWinProbability}%` }} />
              </div>
            </div>
            <div className="prediction-kpi-card">
              <Tooltip content="Margine in punti percentuali tra le due probabilita.">
                <span>Probability gap</span>
              </Tooltip>
              <strong>{probabilityGap.toFixed(1)} pts</strong>
              <p>Misura il distacco netto del modello.</p>
            </div>
            <div className="prediction-kpi-card prediction-kpi-score">
              <Tooltip content="Punteggio finale stimato dal modello.">
                <span>Expected score</span>
              </Tooltip>
              <strong>{prediction.expectedScore}</strong>
              <p>{prediction.edgeDescription}</p>
            </div>
          </section>

          <section className="prediction-analysis-grid">
            <article className="panel prediction-model-card">
              <div className="panel-head prediction-panel-headline">
                <div>
                  <p className="mini-label">Model drivers</p>
                  <h3>Perche il modello vede questo esito</h3>
                </div>
                <p className="helper">Le leve principali che spostano il matchup tra attacco, difesa, forma e controllo del possesso.</p>
              </div>

              <div className="prediction-driver-grid">
                {driverCards.map((driver) => (
                  <article key={driver.label} className="prediction-driver-card">
                    <span>{driver.label}</span>
                    <strong>{driver.team?.abbreviation || 'N/D'}</strong>
                    <p>{driver.value}</p>
                    <small>{driver.note}</small>
                  </article>
                ))}
              </div>

              <div className="prediction-stat-board">
                {statRows.map((row) => {
                  const homeNumeric = safeMetric(row.homeValue);
                  const awayNumeric = safeMetric(row.awayValue);
                  const total = homeNumeric + awayNumeric || 1;
                  const hasComparableData = homeNumeric > 0 || awayNumeric > 0;
                  const homeWidth = hasComparableData ? Math.max((homeNumeric / total) * 100, 10) : 0;
                  const awayWidth = hasComparableData ? Math.max((awayNumeric / total) * 100, 10) : 0;

                  return (
                    <div key={row.label} className="prediction-stat-row">
                      <div className="prediction-stat-side">
                        <strong>{row.format(row.homeValue)}</strong>
                        <span>{prediction.homeTeam.abbreviation}</span>
                      </div>
                      <div className="prediction-stat-center">
                        <Tooltip content={row.tooltip}>
                          <span>{row.label}</span>
                        </Tooltip>
                        <div className="prediction-stat-meter">
                          <div className="prediction-stat-meter-home" style={{ width: `${homeWidth}%` }} />
                          <div className="prediction-stat-meter-away" style={{ width: `${awayWidth}%` }} />
                        </div>
                      </div>
                      <div className="prediction-stat-side prediction-stat-side-away">
                        <strong>{row.format(row.awayValue)}</strong>
                        <span>{prediction.awayTeam.abbreviation}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel prediction-context-card">
              <div className="panel-head prediction-panel-headline">
                <div>
                  <p className="mini-label">Recent context</p>
                  <h3>Contesto e precedenti</h3>
                </div>
                <p className="helper">Forma recente e storico diretto per leggere meglio lo scenario prima della palla a due.</p>
              </div>

              <div className="prediction-context-grid">
                <PredictionGameList
                  title="Head to head"
                  games={recentHeadToHead}
                  focusTeamId={prediction.homeTeam.id}
                  emptyMessage="Nessun precedente recente disponibile tra queste due squadre."
                />
                <PredictionGameList
                  title={`${prediction.homeTeam.abbreviation} ultimi risultati`}
                  games={homeRecentFive.slice(0, 3)}
                  focusTeamId={prediction.homeTeam.id}
                  emptyMessage="Nessun risultato recente disponibile per la squadra di casa."
                />
                <PredictionGameList
                  title={`${prediction.awayTeam.abbreviation} ultimi risultati`}
                  games={awayRecentFive.slice(0, 3)}
                  focusTeamId={prediction.awayTeam.id}
                  emptyMessage="Nessun risultato recente disponibile per la squadra ospite."
                />
              </div>
            </article>
          </section>
        </>
      ) : loadingPrediction ? (
        <Loader
          variant="prediction"
          message="Sto elaborando probabilita, driver e contesto del matchup selezionato."
        />
      ) : (
        <div className="panel state-box">
          <p className="mini-label">Prediction center</p>
          <h3>Seleziona due squadre</h3>
          <p className="helper">Imposta home e away team per visualizzare la control room completa.</p>
        </div>
      )}
    </div>
  );
}
