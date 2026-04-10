import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';
import KpiCard from '../components/KpiCard.jsx';
import BarChart from '../components/BarChart.jsx';
import Loader from '../components/Loader.jsx';
import useAutoRefresh from '../hooks/useAutoRefresh.js';
import { getPlayerImage } from '../data/PlayersImages.js';
import { getTeamLogo } from '../data/TeamsLogo.js';

function safeNumber(value, fallback = -1) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function formatValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? 'N/D' : `${value}${suffix}`;
}

function formatPercent(value, digits = 1) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}%` : 'N/D';
}

function formatDelta(value, digits = 1, suffix = 'pts') {
  if (!Number.isFinite(Number(value))) {
    return 'N/D';
  }

  const numeric = Number(value);
  const sign = numeric > 0 ? '+' : numeric < 0 ? '' : '';
  return `${sign}${numeric.toFixed(digits)} ${suffix}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'N/D';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/D';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function buildKpiStatus(actual, target) {
  const actualNumber = Number(actual);
  const targetNumber = Number(target);

  if (!Number.isFinite(actualNumber) || !Number.isFinite(targetNumber) || targetNumber <= 0) {
    return { label: 'Watch', tone: 'watch' };
  }

  const tolerance = Math.max(0.5, targetNumber * 0.01);

  if (Math.abs(actualNumber - targetNumber) <= tolerance) {
    return { label: 'On target', tone: 'ahead' };
  }

  if (actualNumber > targetNumber) {
    return { label: 'Ahead', tone: 'ahead' };
  }

  if (actualNumber >= targetNumber * 0.95) {
    return { label: 'Watch', tone: 'watch' };
  }

  return { label: 'Risk', tone: 'risk' };
}

export default function DashboardPage() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    }

    try {
      const [overview, players, games] = await Promise.all([
        api('/api/overview'),
        api('/api/players'),
        api('/api/games')
      ]);

      setPayload({ overview, players, games });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useAutoRefresh(() => {
    void loadDashboardData(true);
  }, 60000, true);

  const derived = useMemo(() => {
    if (!payload) return null;

    const topScorer = [...payload.players].sort(
      (a, b) => safeNumber(b.pointsPerGame) - safeNumber(a.pointsPerGame)
    )[0];
    const topEfficiency = [...payload.players].sort(
      (a, b) => safeNumber(b.efficiency) - safeNumber(a.efficiency)
    )[0];
    const leaders = [...payload.players]
      .sort((a, b) => safeNumber(b.pointsPerGame) - safeNumber(a.pointsPerGame))
      .slice(0, 5);
    const recentGames = [...payload.games]
      .filter((game) => game.hasResult)
      .sort(
        (a, b) =>
          safeNumber(new Date(b.datetimeUtc || b.date).getTime()) -
          safeNumber(new Date(a.datetimeUtc || a.date).getTime())
      )
      .slice(0, 4);
    const completedGames = payload.games.filter((game) => game.hasResult).length;

    return { topScorer, topEfficiency, leaders, recentGames, completedGames };
  }, [payload]);

  if (error) return <div className="panel">{error}</div>;
  if (!payload || !derived) return <Loader variant="dashboard" />;

  const { overview } = payload;
  const { topScorer, topEfficiency, leaders, recentGames, completedGames } = derived;
  const runnerUpScorer = leaders[1] || null;
  const lastSyncLabel = formatDateTime(overview.meta?.generatedAt);
  const syncSourceLabel = overview.meta?.source === 'database' ? 'MySQL live' : 'Snapshot locale';
  const seasonLabel = overview.meta?.season ? `Season ${overview.meta.season}` : 'Season current';
  const coverageRate = overview.totals.teams
    ? (safeNumber(overview.totals.trackedStats, 0) / safeNumber(overview.totals.teams, 0)) * 100
    : 0;
  const resultCompletionRate = overview.totals.games
    ? (completedGames / safeNumber(overview.totals.games, 0)) * 100
    : 0;
  const bestRecordWinRate = safeNumber(overview.spotlight.bestRecord.winPct, 0) * 100;
  const bestOffensePpg = safeNumber(overview.spotlight.bestOffense.pointsPerGame, 0);
  const hottestTeamForm = safeNumber(overview.spotlight.hottestTeam.recentForm, 0) * 100;
  const scoringGap = runnerUpScorer
    ? safeNumber(topScorer.pointsPerGame, 0) - safeNumber(runnerUpScorer.pointsPerGame, 0)
    : null;
  const creationLoad = safeNumber(topScorer.pointsPerGame, 0) + safeNumber(topScorer.assistsPerGame, 0);
  const allAroundLine =
    safeNumber(topScorer.pointsPerGame, 0) +
    safeNumber(topScorer.reboundsPerGame, 0) +
    safeNumber(topScorer.assistsPerGame, 0);
  const topPerformerInsights = [
    {
      label: 'Scoring gap',
      value: scoringGap === null ? 'N/D' : formatDelta(scoringGap, 1, 'ppg'),
      helper: runnerUpScorer ? `vs ${runnerUpScorer.name}` : 'Confronto leader non disponibile'
    },
    {
      label: 'Creation load',
      value: `${creationLoad.toFixed(1)}`,
      helper: 'Punti + assist per gara'
    },
    {
      label: 'All-around line',
      value: `${allAroundLine.toFixed(1)}`,
      helper: 'Punti + rimbalzi + assist'
    }
  ];
  const kpiCards = [
    {
      label: 'Team stats coverage',
      value: formatPercent(coverageRate),
      helper: `${overview.totals.trackedStats}/${overview.totals.teams} franchigie con scheda completa`,
      target: '100.0%',
      delta: formatDelta(coverageRate - 100),
      period: seasonLabel,
      formula: 'team stats complete / team totali monitorati',
      status: buildKpiStatus(coverageRate, 100),
      accent: 'amber',
      attainment: coverageRate / 100
    },
    {
      label: 'Result completion',
      value: formatPercent(resultCompletionRate),
      helper: `${completedGames} finali registrate su ${overview.totals.games} gare`,
      target: '90.0%',
      delta: formatDelta(resultCompletionRate - 90),
      period: seasonLabel,
      formula: 'gare con punteggio finale / gare nel dataset',
      status: buildKpiStatus(resultCompletionRate, 90),
      accent: 'blue',
      attainment: resultCompletionRate / 90
    },
    {
      label: 'Leader win rate',
      value: formatPercent(bestRecordWinRate),
      helper: `${overview.spotlight.bestRecord.teamName} guida con record ${overview.spotlight.bestRecord.wins}-${overview.spotlight.bestRecord.losses}`,
      target: '65.0%',
      delta: formatDelta(bestRecordWinRate - 65),
      period: seasonLabel,
      formula: 'wins / partite giocate della squadra leader',
      status: buildKpiStatus(bestRecordWinRate, 65),
      accent: 'violet',
      attainment: bestRecordWinRate / 65
    },
    {
      label: 'Offensive benchmark',
      value: formatValue(bestOffensePpg.toFixed(1), ' PPG'),
      helper: `${overview.spotlight.bestOffense.teamName} e il riferimento scoring corrente`,
      target: '112.0 PPG',
      delta: formatDelta(bestOffensePpg - 112, 1, 'ppg'),
      period: seasonLabel,
      formula: 'punti per gara della squadra piu produttiva',
      status: buildKpiStatus(bestOffensePpg, 112),
      accent: 'ember',
      attainment: bestOffensePpg / 112
    }
  ];
  const dataHighlights = [
    { label: 'Squadre', value: overview.totals.teams },
    { label: 'Giocatori', value: overview.totals.players },
    { label: 'Partite', value: overview.totals.games },
    { label: 'Stat sheets', value: overview.totals.trackedStats }
  ];
  const summaryCards = [
    {
      label: 'Win rate leader',
      value: formatPercent(bestRecordWinRate),
      helper: overview.spotlight.bestRecord.teamName,
      logo: getTeamLogo(overview.spotlight.bestRecord.abbreviation),
      target: 'Target 65%',
      delta: formatDelta(bestRecordWinRate - 65),
      status: buildKpiStatus(bestRecordWinRate, 65)
    },
    {
      label: 'Top offense',
      value: formatValue(bestOffensePpg.toFixed(1), ' PPG'),
      helper: overview.spotlight.bestOffense.teamName,
      logo: getTeamLogo(overview.spotlight.bestOffense.abbreviation),
      target: 'Target 112.0',
      delta: formatDelta(bestOffensePpg - 112, 1, 'ppg'),
      status: buildKpiStatus(bestOffensePpg, 112)
    },
    {
      label: 'Momentum leader',
      value: formatPercent(hottestTeamForm, 0),
      helper: overview.spotlight.hottestTeam.teamName,
      logo: getTeamLogo(overview.spotlight.hottestTeam.abbreviation),
      target: 'Target 70%',
      delta: formatDelta(hottestTeamForm - 70),
      status: buildKpiStatus(hottestTeamForm, 70)
    }
  ];

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        eyebrow="Overview"
        title="League Operations"
        subtitle="Vista esecutiva su segnali di lega, leader e indicatori chiave."
      />

      <section className="executive-grid">
        <article className="panel executive-hero">
          <div className="hero-brief">
            <p className="mini-label">Top performer</p>
            <h3>{topScorer.name}</h3>
            <p className="hero-subline">
              {topScorer.team?.name || 'Team non disponibile'} - {topScorer.position || 'N/D'} -{' '}
              {topScorer.age ? `${topScorer.age} anni` : 'Eta n/d'}
            </p>
            <div className="hero-key-stats">
              <div>
                <span>PPG</span>
                <strong>{formatValue(topScorer.pointsPerGame)}</strong>
              </div>
              <div>
                <span>RPG</span>
                <strong>{formatValue(topScorer.reboundsPerGame)}</strong>
              </div>
              <div>
                <span>APG</span>
                <strong>{formatValue(topScorer.assistsPerGame)}</strong>
              </div>
              <div>
                <span>EFF</span>
                <strong>{formatValue(topScorer.efficiency)}</strong>
              </div>
            </div>
            <div className="hero-links">
              <Link to="/players" className="hero-action-button">
                Apri player database
              </Link>
              <Link to="/predictions" className="hero-action-button secondary-hero-button">
                Apri prediction room
              </Link>
            </div>
          </div>

          <div className="hero-visual-card">
            <div className="hero-player-stage">
              <img src={getPlayerImage(topScorer, 'compact')} alt={topScorer.name} className="hero-player-image" />
            </div>

            <div className="hero-visual-caption">
              <p className="hero-visual-kicker">Scoring leader</p>
              <strong>{topScorer.name}</strong>
              <span>{topScorer.team?.name || 'Team non disponibile'}</span>
            </div>
          </div>

          <div className="hero-insight-grid">
            {topPerformerInsights.map((item) => (
              <div key={item.label} className="hero-insight-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </div>
        </article>

        <section className="panel kpi-board">
          <div className="panel-head">
            <div>
              <p className="mini-label">Selected KPIs</p>
              <h3>Performance and readiness</h3>
              <p className="helper kpi-board-copy">
                Ogni KPI espone obiettivo, scostamento e periodo di lettura invece di mostrare solo
                conteggi grezzi.
              </p>
            </div>
          </div>

          <div className="kpi-grid">
            {kpiCards.map((item) => (
              <KpiCard
                key={item.label}
                label={item.label}
                value={item.value}
                helper={item.helper}
                target={item.target}
                delta={item.delta}
                period={item.period}
                formula={item.formula}
                status={item.status}
                accent={item.accent}
                attainment={item.attainment}
              />
            ))}
          </div>

          <div className="dataset-footprint" aria-label="Dataset footprint">
            {dataHighlights.map((item) => (
              <div key={item.label} className="dataset-footprint-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel executive-rail">
          <div className="rail-section">
            <div className="sync-status-card">
              <div>
                <p className="mini-label">Last sync</p>
                <strong>{lastSyncLabel}</strong>
                <span>
                  {syncSourceLabel} - Season {overview.meta?.season || 'N/D'} -{' '}
                  {isRefreshing ? 'Aggiornamento...' : 'Auto refresh 60s'}
                </span>
              </div>
              <span className="status-pill live-pill">Data ready</span>
            </div>
          </div>

          <div className="rail-section">
            <div className="panel-head">
              <h3>League snapshot</h3>
            </div>
            <div className="summary-card-list">
              {summaryCards.map((item) => (
                <Link key={item.label} to="/teams" className="summary-card">
                  <img src={item.logo} alt={item.helper} className="team-logo summary-logo" />
                  <div>
                    <p className="mini-label">{item.label}</p>
                    <strong>{item.value}</strong>
                    <span>{item.helper}</span>
                    <div className="summary-card-meta">
                      <span className={`summary-card-status summary-card-status-${item.status.tone}`}>
                        {item.status.label}
                      </span>
                      <span>{item.target}</span>
                      <span>{item.delta}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rail-section">
            <div className="panel-head">
              <h3>Efficiency leader</h3>
            </div>
            <div className="efficiency-card">
              <img
                src={getPlayerImage(topEfficiency)}
                alt={topEfficiency.name}
                className="player-photo efficiency-avatar"
              />
              <div>
                <strong>{topEfficiency.name}</strong>
                <p>{topEfficiency.team?.name || 'Team non disponibile'}</p>
              </div>
              <span>{formatValue(topEfficiency.efficiency)}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="executive-content-grid">
        <article className="panel">
          <div className="panel-head">
            <h3>Scoring leaders</h3>
            <Link to="/players" className="mini-link">
              Vedi tutti
            </Link>
          </div>
          <div className="leaders-list">
            {leaders.map((player, index) => (
              <Link key={player.id} to="/players" className="leader-row">
                <span className="leader-rank">{index + 1}</span>
                <img src={getPlayerImage(player)} alt={player.name} className="player-photo leader-avatar" />
                <div className="leader-copy">
                  <strong>{player.name}</strong>
                  <span>
                    {player.team?.abbreviation || 'N/D'} - {player.position || 'N/D'}
                  </span>
                </div>
                <strong className="leader-value">{formatValue(player.pointsPerGame)}</strong>
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>Recent results</h3>
            <Link to="/games" className="mini-link">
              Apri partite
            </Link>
          </div>
          {recentGames.length ? (
            <div className="result-feed">
              {recentGames.map((game) => (
                <Link key={game.id} to="/games" className="result-card">
                  <div className="result-card-top">
                    <span>{game.date}</span>
                    <strong>{game.arena || 'Arena n/d'}</strong>
                  </div>
                  <div className="result-team-line">
                    <div className="result-team-copy">
                      <img
                        src={getTeamLogo(game.homeTeam.abbreviation)}
                        alt={game.homeTeam.name}
                        className="team-logo result-team-logo"
                      />
                      <span>{game.homeTeam.name}</span>
                    </div>
                    <strong>{game.homeScore}</strong>
                  </div>
                  <div className="result-team-line">
                    <div className="result-team-copy">
                      <img
                        src={getTeamLogo(game.awayTeam.abbreviation)}
                        alt={game.awayTeam.name}
                        className="team-logo result-team-logo"
                      />
                      <span>{game.awayTeam.name}</span>
                    </div>
                    <strong>{game.awayScore}</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="state-box">Nessun risultato finale disponibile nel dataset corrente.</div>
          )}
        </article>
      </section>

      <section className="two-col-grid">
        <BarChart title="Top offense" items={overview.offenseChart} suffix=" ppg" />
        <BarChart title="Momentum ultime 10 gare" items={overview.momentumChart} percent />
      </section>

      <section className="panel standings-panel">
        <div className="panel-head">
          <h3>Top 10 per record</h3>
          <Link to="/teams" className="mini-link">
            Apri squadre
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Squadra</th>
                <th>Conf.</th>
                <th>W</th>
                <th>L</th>
                <th>Win%</th>
                <th>PPG</th>
                <th>Forma</th>
              </tr>
            </thead>
            <tbody>
              {overview.standings.map((row) => (
                <tr key={row.teamId}>
                  <td>{row.rank}</td>
                  <td>
                    <div className="standings-team">
                      <img
                        src={getTeamLogo(row.abbreviation)}
                        alt={row.teamName}
                        className="team-logo standings-team-logo"
                      />
                      <span>{row.teamName}</span>
                    </div>
                  </td>
                  <td>{row.conference}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.winPct}</td>
                  <td>{row.pointsPerGame}</td>
                  <td>{(row.recentForm * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
