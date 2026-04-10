import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, isDatabaseConfigured } from '../db.js';
import { getSnapshot } from '../utils/loadSnapshot.js';
import { getVerifiedActivePlayers } from '../utils/loadVerifiedActivePlayers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedSnapshotFile = path.resolve(__dirname, '../data/generatedPlayerSnapshot.json');

const API_BASE = process.env.BALLDONTLIE_API_BASE_URL || 'https://api.balldontlie.io/v1/';
const API_KEY = process.env.BALLDONTLIE_API_KEY;
const PLAN = String(process.env.BALLDONTLIE_PLAN || 'free').trim().toLowerCase();
const CAN_USE_PREMIUM_ENDPOINTS = PLAN === 'all-star' || PLAN === 'goat';
const SHOULD_FETCH_STATS =
  CAN_USE_PREMIUM_ENDPOINTS && String(process.env.BALLDONTLIE_FETCH_STATS || 'true').toLowerCase() !== 'false';
const REQUEST_INTERVAL_MS = Number(
  process.env.BALLDONTLIE_REQUEST_INTERVAL_MS ||
    (PLAN === 'goat' ? 120 : PLAN === 'all-star' ? 1100 : 15000)
);
const MAX_RETRIES = Number(process.env.BALLDONTLIE_MAX_RETRIES || 3);
let lastRequestAt = 0;

const CURRENT_NBA_ABBREVIATIONS = new Set([
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]);

class BalldontlieApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BalldontlieApiError';
    this.status = status;
  }
}

function getDefaultSeason() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  return month >= 8 ? year : year - 1;
}

function getSeasons() {
  const raw = process.env.NBA_SYNC_SEASONS;

  if (!raw) {
    return [getDefaultSeason()];
  }

  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function createUrl(path, params = {}) {
  const url = new URL(path, API_BASE);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(path, params = {}, attempt = 0) {
  if (!API_KEY) {
    throw new Error('Imposta BALLDONTLIE_API_KEY nel file backend/.env prima di eseguire la sync.');
  }

  const now = Date.now();
  const waitMs = Math.max(0, REQUEST_INTERVAL_MS - (now - lastRequestAt));
  if (waitMs) {
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();

  const response = await fetch(createUrl(path, params), {
    headers: {
      Authorization: API_KEY,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new BalldontlieApiError(
        response.status,
        'Chiave BALLDONTLIE_API_KEY non valida o non abilitata per l\'endpoint richiesto.'
      );
    }

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
        const retryDelay = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 65000;
        console.warn(
          `Rate limit balldontlie raggiunto su ${path}. Attendo ${Math.ceil(retryDelay / 1000)}s e ritento (${attempt + 1}/${MAX_RETRIES})...`
        );
        await sleep(retryDelay);
        lastRequestAt = 0;
        return apiRequest(path, params, attempt + 1);
      }

      throw new BalldontlieApiError(
        response.status,
        'Rate limit raggiunto su balldontlie. Aspetta qualche minuto e riprova.'
      );
    }

    throw new BalldontlieApiError(response.status, `balldontlie ${response.status}: ${body}`);
  }

  return response.json();
}

async function fetchAllPages(path, params = {}) {
  const rows = [];
  let cursor = null;

  do {
    const payload = await apiRequest(path, {
      ...params,
      per_page: 100,
      ...(cursor ? { cursor } : {})
    });

    rows.push(...(payload.data || []));
    cursor = payload.meta?.next_cursor ?? null;
  } while (cursor);

  return rows;
}

async function fetchTeams() {
  return fetchAllPages('teams');
}

async function fetchPlayers(teamIds) {
  if (!CAN_USE_PREMIUM_ENDPOINTS) {
    const allPlayers = await fetchAllPages('players', { 'team_ids[]': [...teamIds] });
    return allPlayers.filter((player) => teamIds.has(player.team?.id));
  }

  try {
    return await fetchAllPages('players/active');
  } catch (error) {
    if (error instanceof BalldontlieApiError && [401, 403, 429].includes(error.status)) {
      throw error;
    }

    console.warn(`Endpoint active players non disponibile, provo fallback: ${error.message}`);
    const allPlayers = await fetchAllPages('players', { 'team_ids[]': [...teamIds] });
    return allPlayers.filter((player) => teamIds.has(player.team?.id));
  }
}

async function fetchGames(seasons) {
  const map = new Map();

  for (const season of seasons) {
    const seasonGames = await fetchAllPages('games', { 'seasons[]': season });
    seasonGames.forEach((game) => map.set(game.id, game));
  }

  return [...map.values()];
}

async function fetchStats(seasons) {
  if (!SHOULD_FETCH_STATS) {
    return [];
  }

  const map = new Map();

  for (const season of seasons) {
    const seasonStats = await fetchAllPages('stats', { 'seasons[]': season });
    seasonStats.forEach((item) => {
      const key = `${item.game?.id}:${item.player?.id}`;
      map.set(key, item);
    });
  }

  return [...map.values()];
}

function normalizeTeam(team) {
  return {
    id: team.id,
    name: team.full_name || [team.city, team.name].filter(Boolean).join(' '),
    abbreviation: team.abbreviation,
    conference: team.conference,
    division: team.division,
    city: team.city
  };
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildLocalMaps(snapshot) {
  const teamByAbbreviation = new Map(snapshot.teams.map((team) => [team.abbreviation, team]));
  const teamStatByAbbreviation = new Map(
    snapshot.teamStats.map((stat) => {
      const team = snapshot.teams.find((item) => Number(item.id) === Number(stat.teamId));
      return [team?.abbreviation, stat];
    }).filter(([abbreviation]) => abbreviation)
  );
  const playerByKey = new Map(
    snapshot.players.map((player) => {
      const team = snapshot.teams.find((item) => Number(item.id) === Number(player.team_id));
      const key = `${normalizeName(player.name)}::${team?.abbreviation || ''}`;
      return [key, player];
    })
  );

  return { teamByAbbreviation, teamStatByAbbreviation, playerByKey };
}

function buildAllowedCurrentTeams(snapshot) {
  return new Map(snapshot.teams.map((team) => [team.abbreviation, normalizeName(team.name)]));
}

function readGeneratedPlayerSnapshot() {
  if (!fs.existsSync(generatedSnapshotFile)) {
    return { players: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(generatedSnapshotFile, 'utf-8'));
  } catch {
    return { players: [] };
  }
}

function buildGeneratedPlayerMap(snapshot) {
  return new Map(
    (snapshot.players || []).map((player) => {
      const key = `${normalizeName(player.name)}::${player.teamAbbreviation || ''}`;
      return [key, player];
    })
  );
}

function writeGeneratedPlayerSnapshot(players, teams) {
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const snapshot = {
    generatedAt: new Date().toISOString(),
    players: players.map((player) => ({
      name: player.name,
      teamAbbreviation: teamMap.get(player.teamId)?.abbreviation || '',
      position: player.position ?? null,
      age: player.age ?? null,
      pointsPerGame: player.pointsPerGame ?? null,
      reboundsPerGame: player.reboundsPerGame ?? null,
      assistsPerGame: player.assistsPerGame ?? null,
      efficiency: player.efficiency ?? null
    }))
  };

  fs.writeFileSync(generatedSnapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8');
}

function buildVerifiedActivePlayerSet(snapshot) {
  return new Set(
    (snapshot.players || [])
      .map((player) => normalizeName(player.fullName || player.name))
      .filter(Boolean)
  );
}

function inferPosition(position, rosterIndex) {
  if (position) {
    return position;
  }

  const slots = ['G', 'G', 'F', 'F', 'C'];
  return slots[rosterIndex % slots.length];
}

function createSyntheticPlayerMetrics(player, teamStat, rosterIndex) {
  const roleWeight = Math.max(0.14, 1.18 - rosterIndex * 0.085);
  const basePoints = teamStat ? teamStat.pointsPerGame : 108;
  const baseRebounds = teamStat?.reboundsPerGame ?? 44;
  const baseAssists = teamStat?.assistsPerGame ?? 25;

  const pointsPerGame = Number(Math.max(2.4, basePoints * (0.038 * roleWeight)).toFixed(2));
  const reboundsPerGame = Number(Math.max(1.2, baseRebounds * (0.058 * roleWeight)).toFixed(2));
  const assistsPerGame = Number(Math.max(0.8, baseAssists * (0.064 * roleWeight)).toFixed(2));
  const efficiency = Number((pointsPerGame + reboundsPerGame + assistsPerGame * 1.15).toFixed(2));
  const age =
    player.age ??
    (player.draftYear ? Math.max(19, new Date().getUTCFullYear() - Number(player.draftYear) + 19) : 20 + (rosterIndex % 13));

  return {
    position: inferPosition(player.position, rosterIndex),
    age,
    pointsPerGame,
    reboundsPerGame,
    assistsPerGame,
    efficiency
  };
}

function toSqlDate(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

function toSqlDateTime(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

function isCompletedGame(game) {
  return (
    game &&
    game.homeTeamId &&
    game.awayTeamId &&
    game.homeScore !== null &&
    game.awayScore !== null &&
    !game.postponed
  );
}

function normalizeGame(game) {
  return {
    id: game.id,
    season: game.season ?? null,
    gameDate: toSqlDate(game.date),
    homeTeamId: game.home_team?.id ?? null,
    awayTeamId: game.visitor_team?.id ?? null,
    homeScore: game.home_team_score ?? null,
    awayScore: game.visitor_team_score ?? null,
    status: game.status || 'Scheduled',
    arena: null,
    period: game.period ?? null,
    clock: game.time || null,
    postseason: Number(Boolean(game.postseason)),
    postponed: Number(Boolean(game.postponed)),
    datetimeUtc: toSqlDateTime(game.datetime || game.date)
  };
}

function calculateEfficiency(stat) {
  const points = Number(stat.pts || 0);
  const rebounds = Number(stat.reb || 0);
  const assists = Number(stat.ast || 0);
  const steals = Number(stat.stl || 0);
  const blocks = Number(stat.blk || 0);
  const turnovers = Number(stat.turnover || 0);
  const missedFieldGoals = Number(stat.fga || 0) - Number(stat.fgm || 0);
  const missedFreeThrows = Number(stat.fta || 0) - Number(stat.ftm || 0);

  return points + rebounds + assists + steals + blocks - missedFieldGoals - missedFreeThrows - turnovers;
}

function buildPlayerAverageMap(stats, latestSeason) {
  const aggregates = new Map();

  stats.forEach((stat) => {
    if (stat.game?.season !== latestSeason) {
      return;
    }

    const playerId = stat.player?.id;
    if (!playerId) {
      return;
    }

    const current = aggregates.get(playerId) || {
      games: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      efficiency: 0
    };

    current.games += 1;
    current.points += Number(stat.pts || 0);
    current.rebounds += Number(stat.reb || 0);
    current.assists += Number(stat.ast || 0);
    current.efficiency += calculateEfficiency(stat);

    aggregates.set(playerId, current);
  });

  const averages = new Map();

  aggregates.forEach((value, key) => {
    const games = Math.max(value.games, 1);
    averages.set(key, {
      pointsPerGame: Number((value.points / games).toFixed(2)),
      reboundsPerGame: Number((value.rebounds / games).toFixed(2)),
      assistsPerGame: Number((value.assists / games).toFixed(2)),
      efficiency: Number((value.efficiency / games).toFixed(2))
    });
  });

  return averages;
}

function normalizePlayer(player, averages) {
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();
  const teamId = player.team?.id ?? null;
  const playerAverages = averages.get(player.id) || {};

  return {
    id: player.id,
    teamId,
    firstName: player.first_name || null,
    lastName: player.last_name || null,
    name: fullName || player.first_name || player.last_name || `Player ${player.id}`,
    position: player.position || null,
    age: null,
    height: player.height || null,
    weight: player.weight || null,
    jerseyNumber: player.jersey_number || null,
    college: player.college || null,
    country: player.country || null,
    draftYear: player.draft_year || null,
    draftRound: player.draft_round || null,
    draftNumber: player.draft_number || null,
    isActive: Number(Boolean(teamId)),
    pointsPerGame: playerAverages.pointsPerGame ?? null,
    reboundsPerGame: playerAverages.reboundsPerGame ?? null,
    assistsPerGame: playerAverages.assistsPerGame ?? null,
    efficiency: playerAverages.efficiency ?? null
  };
}

function mergeLocalPlayer(player, teamAbbreviation, localPlayer) {
  if (!localPlayer) {
    return player;
  }

  return {
    ...player,
    position: player.position || localPlayer.position || null,
    age: player.age ?? localPlayer.age ?? null,
    pointsPerGame: player.pointsPerGame ?? localPlayer.pointsPerGame ?? null,
    reboundsPerGame: player.reboundsPerGame ?? localPlayer.reboundsPerGame ?? null,
    assistsPerGame: player.assistsPerGame ?? localPlayer.assistsPerGame ?? null,
    efficiency: player.efficiency ?? localPlayer.efficiency ?? null,
    teamAbbreviation
  };
}

function enrichPlayersWithFallback(players, teams, teamStats, localMaps, generatedPlayerMap) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const teamStatsById = new Map(teamStats.map((teamStat) => [teamStat.teamId, teamStat]));
  const rosters = new Map();

  players.forEach((player) => {
    const current = rosters.get(player.teamId) || [];
    current.push(player);
    rosters.set(player.teamId, current);
  });

  rosters.forEach((roster) => {
    roster.sort((a, b) => a.name.localeCompare(b.name));
  });

  return players.map((player) => {
    const team = teamById.get(player.teamId);
    const teamAbbreviation = team?.abbreviation || '';
    const localKey = `${normalizeName(player.name)}::${teamAbbreviation}`;
    const localPlayer = localMaps.playerByKey.get(localKey) || generatedPlayerMap.get(localKey);
    const merged = mergeLocalPlayer(player, teamAbbreviation, localPlayer);
    const roster = rosters.get(player.teamId) || [];
    const rosterIndex = Math.max(0, roster.findIndex((item) => item.id === player.id));
    const synthetic = createSyntheticPlayerMetrics(merged, teamStatsById.get(player.teamId), rosterIndex);

    return {
      ...merged,
      position: merged.position || synthetic.position,
      age: merged.age ?? synthetic.age,
      pointsPerGame: merged.pointsPerGame ?? synthetic.pointsPerGame,
      reboundsPerGame: merged.reboundsPerGame ?? synthetic.reboundsPerGame,
      assistsPerGame: merged.assistsPerGame ?? synthetic.assistsPerGame,
      efficiency: merged.efficiency ?? synthetic.efficiency
    };
  });
}

function normalizePlayerGameStats(stats, latestSeason) {
  return stats
    .filter((stat) => stat.game?.season === latestSeason && stat.player?.id && stat.team?.id)
    .map((stat) => ({
      gameId: stat.game.id,
      playerId: stat.player.id,
      teamId: stat.team.id,
      minutes: stat.min || null,
      points: stat.pts ?? null,
      rebounds: stat.reb ?? null,
      assists: stat.ast ?? null,
      steals: stat.stl ?? null,
      blocks: stat.blk ?? null,
      turnovers: stat.turnover ?? null,
      fieldGoalsMade: stat.fgm ?? null,
      fieldGoalsAttempted: stat.fga ?? null,
      freeThrowsMade: stat.ftm ?? null,
      freeThrowsAttempted: stat.fta ?? null,
      threePointsMade: stat.fg3m ?? null,
      threePointsAttempted: stat.fg3a ?? null,
      offensiveRebounds: stat.oreb ?? null,
      defensiveRebounds: stat.dreb ?? null,
      personalFouls: stat.pf ?? null,
      plusMinus: stat.plus_minus ?? null
    }));
}

function buildTeamStats(teams, games, playerGameStats, latestSeason) {
  const teamMap = new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        season: latestSeason,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winPct: 0,
        pointsPerGame: 0,
        pointsAllowedPerGame: 0,
        reboundsPerGame: null,
        assistsPerGame: null,
        recentForm: 0,
        lastSyncedAt: new Date()
      }
    ])
  );

  const recentResults = new Map();

  games
    .filter((game) => game.season === latestSeason && isCompletedGame(game))
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
    .forEach((game) => {
      const home = teamMap.get(game.homeTeamId);
      const away = teamMap.get(game.awayTeamId);

      if (!home || !away) {
        return;
      }

      home.gamesPlayed += 1;
      away.gamesPlayed += 1;
      home.pointsPerGame += Number(game.homeScore || 0);
      away.pointsPerGame += Number(game.awayScore || 0);
      home.pointsAllowedPerGame += Number(game.awayScore || 0);
      away.pointsAllowedPerGame += Number(game.homeScore || 0);

      const homeWon = Number(game.homeScore) > Number(game.awayScore);
      home.wins += homeWon ? 1 : 0;
      home.losses += homeWon ? 0 : 1;
      away.wins += homeWon ? 0 : 1;
      away.losses += homeWon ? 1 : 0;

      recentResults.set(home.teamId, [...(recentResults.get(home.teamId) || []), homeWon ? 1 : 0]);
      recentResults.set(away.teamId, [...(recentResults.get(away.teamId) || []), homeWon ? 0 : 1]);
    });

  if (playerGameStats.length) {
    const teamGameTotals = new Map();

    playerGameStats.forEach((stat) => {
      const key = `${stat.gameId}:${stat.teamId}`;
      const current = teamGameTotals.get(key) || { teamId: stat.teamId, rebounds: 0, assists: 0 };
      current.rebounds += Number(stat.rebounds || 0);
      current.assists += Number(stat.assists || 0);
      teamGameTotals.set(key, current);
    });

    const teamTotals = new Map();

    teamGameTotals.forEach((value) => {
      const current = teamTotals.get(value.teamId) || { rebounds: 0, assists: 0, games: 0 };
      current.rebounds += value.rebounds;
      current.assists += value.assists;
      current.games += 1;
      teamTotals.set(value.teamId, current);
    });

    teamTotals.forEach((value, teamId) => {
      const target = teamMap.get(teamId);
      if (!target) {
        return;
      }

      const gamesPlayed = Math.max(value.games, 1);
      target.reboundsPerGame = Number((value.rebounds / gamesPlayed).toFixed(2));
      target.assistsPerGame = Number((value.assists / gamesPlayed).toFixed(2));
    });
  }

  teamMap.forEach((team) => {
    const gamesPlayed = Math.max(team.gamesPlayed, 1);
    team.winPct = Number((team.wins / gamesPlayed).toFixed(3));
    team.pointsPerGame = Number((team.pointsPerGame / gamesPlayed).toFixed(2));
    team.pointsAllowedPerGame = Number((team.pointsAllowedPerGame / gamesPlayed).toFixed(2));

    const recent = (recentResults.get(team.teamId) || []).slice(0, 10);
    const recentGames = Math.max(recent.length, 1);
    team.recentForm = Number((recent.reduce((sum, item) => sum + item, 0) / recentGames).toFixed(3));
  });

  return [...teamMap.values()];
}

function mergeLocalTeamStats(teamStats, teams, localMaps) {
  return teamStats.map((teamStat) => {
    const team = teams.find((item) => Number(item.id) === Number(teamStat.teamId));
    const fallback = team ? localMaps.teamStatByAbbreviation.get(team.abbreviation) : null;

    if (!fallback) {
      return teamStat;
    }

    return {
      ...teamStat,
      reboundsPerGame: teamStat.reboundsPerGame ?? fallback.reboundsPerGame ?? null,
      assistsPerGame: teamStat.assistsPerGame ?? fallback.assistsPerGame ?? null
    };
  });
}

async function clearLiveTables(connection) {
  await connection.query('DELETE FROM player_game_stats');
  await connection.query('DELETE FROM team_stats');
  await connection.query('DELETE FROM games');
  await connection.query('DELETE FROM players');
  await connection.query('DELETE FROM teams');
}

async function hasTable(connection, tableName) {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureLiveSchema(connection) {
  const checks = [
    ['player_game_stats', null],
    ['players', 'first_name'],
    ['games', 'season'],
    ['team_stats', 'season']
  ];

  for (const [tableName, columnName] of checks) {
    if (columnName) {
      if (!(await hasColumn(connection, tableName, columnName))) {
        throw new Error(
          `Manca la colonna ${tableName}.${columnName}. Esegui prima database/live_upgrade.sql in MySQL Workbench.`
        );
      }
      continue;
    }

    if (!(await hasTable(connection, tableName))) {
      throw new Error(`Manca la tabella ${tableName}. Esegui prima database/live_upgrade.sql in MySQL Workbench.`);
    }
  }
}

async function insertTeams(connection, teams) {
  if (!teams.length) {
    return;
  }

  await connection.query(
    `
      INSERT INTO teams (id, name, abbreviation, conference, division, city)
      VALUES ?
    `,
    [teams.map((team) => [team.id, team.name, team.abbreviation, team.conference, team.division, team.city])]
  );
}

async function insertPlayers(connection, players) {
  if (!players.length) {
    return;
  }

  await connection.query(
    `
      INSERT INTO players (
        id, team_id, first_name, last_name, name, position, age, height, weight, jersey_number,
        college, country, draft_year, draft_round, draft_number, is_active,
        points_per_game, rebounds_per_game, assists_per_game, efficiency
      )
      VALUES ?
    `,
    [
      players.map((player) => [
        player.id,
        player.teamId,
        player.firstName,
        player.lastName,
        player.name,
        player.position,
        player.age,
        player.height,
        player.weight,
        player.jerseyNumber,
        player.college,
        player.country,
        player.draftYear,
        player.draftRound,
        player.draftNumber,
        player.isActive,
        player.pointsPerGame,
        player.reboundsPerGame,
        player.assistsPerGame,
        player.efficiency
      ])
    ]
  );
}

async function insertGames(connection, games) {
  if (!games.length) {
    return;
  }

  await connection.query(
    `
      INSERT INTO games (
        id, season, game_date, home_team_id, away_team_id, home_score, away_score,
        status, arena, period, clock, postseason, postponed, datetime_utc
      )
      VALUES ?
    `,
    [
      games.map((game) => [
        game.id,
        game.season,
        game.gameDate,
        game.homeTeamId,
        game.awayTeamId,
        game.homeScore,
        game.awayScore,
        game.status,
        game.arena,
        game.period,
        game.clock,
        game.postseason,
        game.postponed,
        game.datetimeUtc
      ])
    ]
  );
}

async function insertPlayerGameStats(connection, stats) {
  if (!stats.length) {
    return;
  }

  const chunkSize = 1000;

  for (let index = 0; index < stats.length; index += chunkSize) {
    const chunk = stats.slice(index, index + chunkSize);
    await connection.query(
      `
        INSERT INTO player_game_stats (
          game_id, player_id, team_id, minutes, points, rebounds, assists, steals, blocks,
          turnovers, field_goals_made, field_goals_attempted, free_throws_made, free_throws_attempted,
          three_points_made, three_points_attempted, offensive_rebounds, defensive_rebounds,
          personal_fouls, plus_minus
        )
        VALUES ?
      `,
      [
        chunk.map((item) => [
          item.gameId,
          item.playerId,
          item.teamId,
          item.minutes,
          item.points,
          item.rebounds,
          item.assists,
          item.steals,
          item.blocks,
          item.turnovers,
          item.fieldGoalsMade,
          item.fieldGoalsAttempted,
          item.freeThrowsMade,
          item.freeThrowsAttempted,
          item.threePointsMade,
          item.threePointsAttempted,
          item.offensiveRebounds,
          item.defensiveRebounds,
          item.personalFouls,
          item.plusMinus
        ])
      ]
    );
  }
}

async function insertTeamStats(connection, teamStats) {
  if (!teamStats.length) {
    return;
  }

  await connection.query(
    `
      INSERT INTO team_stats (
        team_id, season, wins, losses, games_played, win_pct, points_per_game,
        points_allowed_per_game, rebounds_per_game, assists_per_game, recent_form, last_synced_at
      )
      VALUES ?
    `,
    [
      teamStats.map((team) => [
        team.teamId,
        team.season,
        team.wins,
        team.losses,
        team.gamesPlayed,
        team.winPct,
        team.pointsPerGame,
        team.pointsAllowedPerGame,
        team.reboundsPerGame,
        team.assistsPerGame,
        team.recentForm,
        toSqlDateTime(team.lastSyncedAt)
      ])
    ]
  );
}

async function main() {
  if (!isDatabaseConfigured()) {
    throw new Error('Configura DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME nel file backend/.env.');
  }

  const seasons = getSeasons();
  const latestSeason = Math.max(...seasons);
  const pool = getPool();
  const localSnapshot = getSnapshot();
  const localMaps = buildLocalMaps(localSnapshot);
  const allowedCurrentTeams = buildAllowedCurrentTeams(localSnapshot);
  const generatedSnapshot = readGeneratedPlayerSnapshot();
  const generatedPlayerMap = buildGeneratedPlayerMap(generatedSnapshot);
  const verifiedPlayersSnapshot = getVerifiedActivePlayers();
  const verifiedActivePlayers = buildVerifiedActivePlayerSet(verifiedPlayersSnapshot);

  console.log(`Sync NBA live per seasons ${seasons.join(', ')}...`);
  console.log(`Piano balldontlie: ${PLAN}. Intervallo richieste: ${REQUEST_INTERVAL_MS}ms.`);
  if (!CAN_USE_PREMIUM_ENDPOINTS) {
    console.log(
      'Modalita free: uso Teams, Players e Games. Active Players e Game Player Stats non sono inclusi, quindi alcune medie giocatore resteranno vuote.'
    );
  }

  const rawTeams = await fetchTeams();
  const teams = rawTeams
    .map(normalizeTeam)
    .filter((team) => {
      const allowedName = allowedCurrentTeams.get(team.abbreviation);
      return (
        CURRENT_NBA_ABBREVIATIONS.has(team.abbreviation) &&
        Boolean(allowedName) &&
        normalizeName(team.name) === allowedName
      );
    });
  const teamIds = new Set(teams.map((team) => team.id));

  const rawPlayers = await fetchPlayers(teamIds);
  const rawGames = await fetchGames(seasons);
  const normalizedGames = rawGames
    .map(normalizeGame)
    .filter((game) => teamIds.has(game.homeTeamId) && teamIds.has(game.awayTeamId));
  const rawStats = await fetchStats([latestSeason]);

  if (SHOULD_FETCH_STATS && !rawStats.length) {
    throw new Error(
      'Nessuna statistica giocatore ricevuta. Per avere roster + medie reali + predizioni consistenti usa una chiave balldontlie con accesso ad Active Players e Game Player Stats.'
    );
  }

  const playerAverageMap = buildPlayerAverageMap(rawStats, latestSeason);
  const basePlayers = rawPlayers
    .filter((player) => teamIds.has(player.team?.id))
    .filter((player) => {
      if (!verifiedActivePlayers.size) {
        return true;
      }

      const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();
      return verifiedActivePlayers.has(normalizeName(fullName));
    })
    .map((player) => {
      const normalized = normalizePlayer(player, playerAverageMap);
      const team = teams.find((item) => Number(item.id) === Number(normalized.teamId));
      const localKey = `${normalizeName(normalized.name)}::${team?.abbreviation || ''}`;
      return mergeLocalPlayer(normalized, team?.abbreviation || '', localMaps.playerByKey.get(localKey));
    });
  const playerIds = new Set(basePlayers.map((player) => player.id));
  const playerGameStats = normalizePlayerGameStats(rawStats, latestSeason).filter((item) => playerIds.has(item.playerId));
  const baseTeamStats = mergeLocalTeamStats(
    buildTeamStats(teams, normalizedGames, playerGameStats, latestSeason),
    teams,
    localMaps
  );
  const players = enrichPlayersWithFallback(basePlayers, teams, baseTeamStats, localMaps, generatedPlayerMap);
  const teamStats = baseTeamStats;

  const connection = await pool.getConnection();

  try {
    await ensureLiveSchema(connection);
    await connection.beginTransaction();
    await clearLiveTables(connection);
    await insertTeams(connection, teams);
    await insertPlayers(connection, players);
    await insertGames(connection, normalizedGames);
    await insertPlayerGameStats(connection, playerGameStats);
    await insertTeamStats(connection, teamStats);
    await connection.commit();
    writeGeneratedPlayerSnapshot(players, teams);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  console.log(
    `Sync completata: ${teams.length} teams, ${players.length} players, ${normalizedGames.length} games, ${playerGameStats.length} player game stats.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
