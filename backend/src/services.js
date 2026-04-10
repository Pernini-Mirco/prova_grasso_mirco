import { OAuth2Client } from 'google-auth-library';
import { canUseDatabase, isDatabaseConfigured, query } from './db.js';
import { getSnapshot } from './utils/loadSnapshot.js';
import { getGeneratedPlayerSnapshot } from './utils/loadGeneratedPlayerSnapshot.js';
import { getVerifiedActivePlayers } from './utils/loadVerifiedActivePlayers.js';
import {
  createLocalUser,
  findUserByEmail,
  normalizeEmail,
  sanitizeUser,
  updateLocalUser,
  upsertGoogleUser,
  verifyPassword
} from './utils/userStore.js';

const googleClient = new OAuth2Client();
const CURRENT_NBA_ABBREVIATIONS = new Set([
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
]);
const ARENA_BY_TEAM_ABBREVIATION = {
  ATL: 'State Farm Arena',
  BOS: 'TD Garden',
  BKN: 'Barclays Center',
  CHA: 'Spectrum Center',
  CHI: 'United Center',
  CLE: 'Rocket Arena',
  DAL: 'American Airlines Center',
  DEN: 'Ball Arena',
  DET: 'Little Caesars Arena',
  GSW: 'Chase Center',
  HOU: 'Toyota Center',
  IND: 'Gainbridge Fieldhouse',
  LAC: 'Intuit Dome',
  LAL: 'Crypto.com Arena',
  MEM: 'FedExForum',
  MIA: 'Kaseya Center',
  MIL: 'Fiserv Forum',
  MIN: 'Target Center',
  NOP: 'Smoothie King Center',
  NYK: 'Madison Square Garden',
  OKC: 'Paycom Center',
  ORL: 'Kia Center',
  PHI: 'Xfinity Mobile Arena',
  PHX: 'Mortgage Matchup Center',
  POR: 'Moda Center',
  SAC: 'Golden 1 Center',
  SAS: 'Frost Bank Center',
  TOR: 'Scotiabank Arena',
  UTA: 'Delta Center',
  WAS: 'Capital One Arena'
};

function normalizeNameKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function withTeam(data, teamId) {
  return data.teams.find((team) => Number(team.id) === Number(teamId));
}

function withStats(data, teamId) {
  return data.teamStats.find((stat) => Number(stat.teamId) === Number(teamId));
}

function buildLocalPlayerMaps(snapshot, generatedSnapshot) {
  const localPlayerMap = new Map(
    snapshot.players.map((player) => {
      const team = snapshot.teams.find((item) => Number(item.id) === Number(player.team_id));
      return [`${normalizeNameKey(player.name)}::${team?.abbreviation || ''}`, player];
    })
  );

  const generatedPlayerMap = new Map(
    (generatedSnapshot.players || []).map((player) => [
      `${normalizeNameKey(player.name)}::${player.teamAbbreviation || ''}`,
      player
    ])
  );

  return { localPlayerMap, generatedPlayerMap };
}

function buildLocalTeamStatMap(snapshot) {
  return new Map(
    snapshot.teamStats.map((stat) => {
      const team = snapshot.teams.find((item) => Number(item.id) === Number(stat.teamId));
      return [team?.abbreviation, stat];
    }).filter(([abbreviation]) => abbreviation)
  );
}

function buildAllowedCurrentTeams(snapshot) {
  return new Map(snapshot.teams.map((team) => [team.abbreviation, normalizeNameKey(team.name)]));
}

function buildVerifiedActivePlayerSet(snapshot) {
  return new Set(
    (snapshot.players || [])
      .map((player) => normalizeNameKey(player.fullName || player.name))
      .filter(Boolean)
  );
}

function isIsoDateStatus(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(String(value || ''));
}

function inferArenaName(homeTeam) {
  if (!homeTeam?.abbreviation) {
    return null;
  }

  return ARENA_BY_TEAM_ABBREVIATION[homeTeam.abbreviation] || null;
}

function normalizeGameStatus(game) {
  if (Number(game.postponed)) {
    return 'Postponed';
  }

  if (
    String(game.status || '').toLowerCase() === 'final' ||
    String(game.clock || '').toLowerCase() === 'final'
  ) {
    return 'Final';
  }

  if (Number(game.homeScore) > 0 || Number(game.awayScore) > 0) {
    return 'Final';
  }

  if (Number(game.period) > 0) {
    return game.clock ? `Live Q${game.period} / ${game.clock}` : `Live Q${game.period}`;
  }

  if (isIsoDateStatus(game.status)) {
    return 'Scheduled';
  }

  return game.status || 'Scheduled';
}

async function loadDatabaseSnapshot() {
  const localSnapshot = getSnapshot();
  const generatedSnapshot = getGeneratedPlayerSnapshot();
  const verifiedPlayersSnapshot = getVerifiedActivePlayers();
  const { localPlayerMap, generatedPlayerMap } = buildLocalPlayerMaps(localSnapshot, generatedSnapshot);
  const localTeamStatMap = buildLocalTeamStatMap(localSnapshot);
  const allowedCurrentTeams = buildAllowedCurrentTeams(localSnapshot);
  const verifiedActivePlayers = buildVerifiedActivePlayerSet(verifiedPlayersSnapshot);

  const snapshotInfoRows = await query(`
    SELECT
      MAX(last_synced_at) AS lastSyncedAt,
      MAX(season) AS season
    FROM team_stats
  `);

  const teams = await query(`
    SELECT id, name, abbreviation, conference, division, city
    FROM teams
    ORDER BY id ASC
  `);

  const teamStats = await query(`
    SELECT
      team_id AS teamId,
      wins,
      losses,
      season,
      games_played AS gamesPlayed,
      win_pct AS winPct,
      points_per_game AS pointsPerGame,
      points_allowed_per_game AS pointsAllowedPerGame,
      rebounds_per_game AS reboundsPerGame,
      assists_per_game AS assistsPerGame,
      recent_form AS recentForm,
      last_synced_at AS lastSyncedAt
    FROM team_stats
    ORDER BY team_id ASC
  `);

  const players = await query(`
    SELECT
      id,
      team_id,
      first_name AS firstName,
      last_name AS lastName,
      name,
      position,
      age,
      height,
      weight,
      jersey_number AS jerseyNumber,
      college,
      country,
      draft_year AS draftYear,
      draft_round AS draftRound,
      draft_number AS draftNumber,
      is_active AS isActive,
      points_per_game AS pointsPerGame,
      rebounds_per_game AS reboundsPerGame,
      assists_per_game AS assistsPerGame,
      efficiency
    FROM players
    ORDER BY id ASC
  `);

  const games = await query(`
    SELECT
      id,
      DATE_FORMAT(game_date, '%Y-%m-%d') AS date,
      home_team_id AS homeTeamId,
      away_team_id AS awayTeamId,
      season,
      home_score AS homeScore,
      away_score AS awayScore,
      status,
      arena,
      period,
      clock,
      postseason,
      postponed,
      DATE_FORMAT(datetime_utc, '%Y-%m-%d %H:%i:%s') AS datetimeUtc
    FROM games
    ORDER BY game_date DESC, id DESC
  `);

  const snapshotInfo = snapshotInfoRows[0] || {};
  const generatedAt = snapshotInfo.lastSyncedAt
    ? new Date(snapshotInfo.lastSyncedAt).toISOString().slice(0, 19).replace('T', ' ')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  const filteredTeams = teams.filter((team) => {
    const allowedName = allowedCurrentTeams.get(team.abbreviation);
    return (
      CURRENT_NBA_ABBREVIATIONS.has(team.abbreviation) &&
      Boolean(allowedName) &&
      normalizeNameKey(team.name) === allowedName
    );
  });
  const activeTeamIds = new Set(filteredTeams.map((team) => Number(team.id)));
  const teamById = new Map(filteredTeams.map((team) => [Number(team.id), team]));
  const filteredTeamStats = teamStats
    .filter((stat) => activeTeamIds.has(Number(stat.teamId)))
    .map((stat) => {
      const team = teamById.get(Number(stat.teamId));
      const fallback = team ? localTeamStatMap.get(team.abbreviation) : null;

      return {
        ...stat,
        reboundsPerGame: stat.reboundsPerGame ?? fallback?.reboundsPerGame ?? null,
        assistsPerGame: stat.assistsPerGame ?? fallback?.assistsPerGame ?? null
      };
    });
  const filteredPlayers = players
    .filter((player) => activeTeamIds.has(Number(player.team_id)))
    .filter((player) => {
      if (!verifiedActivePlayers.size) {
        return true;
      }

      return verifiedActivePlayers.has(normalizeNameKey(player.name));
    })
    .map((player) => {
      const team = teamById.get(Number(player.team_id));
      const key = `${normalizeNameKey(player.name)}::${team?.abbreviation || ''}`;
      const fallback = localPlayerMap.get(key) || generatedPlayerMap.get(key);

      return {
        ...player,
        position: player.position || fallback?.position || null,
        age: player.age ?? fallback?.age ?? null,
        pointsPerGame: player.pointsPerGame ?? fallback?.pointsPerGame ?? null,
        reboundsPerGame: player.reboundsPerGame ?? fallback?.reboundsPerGame ?? null,
        assistsPerGame: player.assistsPerGame ?? fallback?.assistsPerGame ?? null,
        efficiency: player.efficiency ?? fallback?.efficiency ?? null
      };
    });
  const filteredGames = games
    .filter((game) => activeTeamIds.has(Number(game.homeTeamId)) && activeTeamIds.has(Number(game.awayTeamId)))
    .map((game) => {
      const homeTeam = teamById.get(Number(game.homeTeamId));
      const normalizedStatus = normalizeGameStatus(game);
      const hasResult =
        normalizedStatus === 'Final' || Number(game.homeScore) > 0 || Number(game.awayScore) > 0;

      return {
        ...game,
        status: normalizedStatus,
        arena: game.arena || inferArenaName(homeTeam),
        hasResult
      };
    });

  return {
    meta: {
      source: 'database',
      generatedAt,
      season: snapshotInfo.season ?? null,
      note: 'Live MySQL dataset'
    },
    teams: filteredTeams,
    teamStats: filteredTeamStats,
    players: filteredPlayers,
    games: filteredGames
  };
}

async function getData() {
  if (isDatabaseConfigured()) {
    if (!(await canUseDatabase())) {
      throw new Error('Database MySQL configurato ma non raggiungibile.');
    }

    return loadDatabaseSnapshot();
  }

  const snapshot = getSnapshot();
  return {
    ...snapshot,
    meta: {
      ...(snapshot.meta || {}),
      source: 'snapshot',
      note: snapshot.meta?.note || 'Local fallback snapshot'
    }
  };
}

function sanitizeDatabaseUser(user) {
  return {
    id: user.email,
    email: user.email,
    name: user.name,
    role: user.role,
    provider: 'local',
    avatar: null
  };
}

async function findDatabaseUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const rows = await query(
    `
      SELECT email, password, role, name
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [normalizedEmail]
  );

  return rows[0] ?? null;
}

async function createDatabaseUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  await query(
    `
      INSERT INTO users (email, password, role, name)
      VALUES (?, ?, 'viewer', ?)
    `,
    [normalizedEmail, password, String(name).trim()]
  );

  return {
    email: normalizedEmail,
    password,
    role: 'viewer',
    name: String(name).trim()
  };
}

async function findManagedUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (isDatabaseConfigured() && (await canUseDatabase())) {
    const databaseUser = await findDatabaseUserByEmail(normalizedEmail);

    if (databaseUser) {
      return { source: 'database', user: databaseUser };
    }
  }

  const localUser = findUserByEmail(normalizedEmail);
  if (localUser) {
    return { source: 'local', user: localUser };
  }

  return null;
}

function sanitizeManagedUser(record) {
  return record.source === 'database'
    ? sanitizeDatabaseUser(record.user)
    : sanitizeUser(record.user);
}

async function updateDatabaseUserProfile(email, { name, password }) {
  const normalizedEmail = normalizeEmail(email);
  const current = await findDatabaseUserByEmail(normalizedEmail);

  if (!current) {
    return null;
  }

  await query(
    `
      UPDATE users
      SET name = ?, password = ?
      WHERE email = ?
    `,
    [String(name).trim(), password ?? current.password, normalizedEmail]
  );

  return findDatabaseUserByEmail(normalizedEmail);
}

export async function getOverview() {
  const data = await getData();
  const standings = [...data.teamStats]
    .sort((a, b) => b.winPct - a.winPct)
    .map((stat, index) => {
      const team = withTeam(data, stat.teamId);
      return {
        rank: index + 1,
        teamId: stat.teamId,
        teamName: team?.name ?? 'N/D',
        abbreviation: team?.abbreviation ?? 'N/D',
        conference: team?.conference ?? 'N/D',
        wins: stat.wins,
        losses: stat.losses,
        winPct: stat.winPct,
        pointsPerGame: stat.pointsPerGame,
        recentForm: stat.recentForm
      };
    });

  const offenseChart = standings.slice(0, 8).map((item) => ({
    label: item.abbreviation,
    value: item.pointsPerGame
  }));

  const momentumChart = [...standings]
    .sort((a, b) => b.recentForm - a.recentForm)
    .slice(0, 8)
    .map((item) => ({
      label: item.abbreviation,
      value: Number((item.recentForm * 100).toFixed(0))
    }));

  return {
    meta: {
      source: data.meta?.source ?? null,
      generatedAt: data.meta?.generatedAt ?? null,
      season: data.meta?.season ?? null,
      note: data.meta?.note ?? ''
    },
    totals: {
      teams: data.teams.length,
      players: data.players.length,
      games: data.games.length,
      trackedStats: data.teamStats.length
    },
    spotlight: {
      bestRecord: standings[0],
      bestOffense: [...standings].sort((a, b) => b.pointsPerGame - a.pointsPerGame)[0],
      hottestTeam: [...standings].sort((a, b) => b.recentForm - a.recentForm)[0]
    },
    standings: standings.slice(0, 10),
    offenseChart,
    momentumChart
  };
}

export async function getTeams() {
  const data = await getData();
  return data.teams.map((team) => ({
    ...team,
    stats: withStats(data, team.id)
  }));
}

export async function getPlayers() {
  const data = await getData();
  return data.players.map((player) => ({
    ...player,
    team: withTeam(data, player.team_id)
  }));
}

export async function getGames() {
  const data = await getData();
  return data.games.map((game) => ({
    ...game,
    homeTeam: withTeam(data, game.homeTeamId),
    awayTeam: withTeam(data, game.awayTeamId)
  }));
}

async function ensureWritableDatabase() {
  if (!isDatabaseConfigured()) {
    throw new Error('Le modifiche admin richiedono il database MySQL configurato.');
  }

  if (!(await canUseDatabase())) {
    throw new Error('Database MySQL configurato ma non raggiungibile.');
  }
}

function coerceNumber(value, fieldName, { min = 0, max = Number.POSITIVE_INFINITY, decimals = 2 } = {}) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`Valore non valido per ${fieldName}.`);
  }

  if (numeric < min || numeric > max) {
    throw new Error(`Il campo ${fieldName} deve essere compreso tra ${min} e ${max}.`);
  }

  return Number(numeric.toFixed(decimals));
}

function coerceInteger(value, fieldName, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric)) {
    throw new Error(`Valore intero non valido per ${fieldName}.`);
  }

  if (numeric < min || numeric > max) {
    throw new Error(`Il campo ${fieldName} deve essere compreso tra ${min} e ${max}.`);
  }

  return numeric;
}

export async function getAdminEditorData() {
  await ensureWritableDatabase();

  const [teams, games] = await Promise.all([getTeams(), getGames()]);

  return {
    teams: teams.sort((a, b) => a.name.localeCompare(b.name)),
    games: games
      .sort((a, b) => {
        if (a.hasResult !== b.hasResult) {
          return a.hasResult ? -1 : 1;
        }

        return new Date(b.datetimeUtc || b.date) - new Date(a.datetimeUtc || a.date);
      })
      .slice(0, 120)
  };
}

export async function updateTeamStats(teamId, payload) {
  await ensureWritableDatabase();

  const normalizedTeamId = coerceInteger(teamId, 'teamId', { min: 1 });
  const wins = coerceInteger(payload.wins, 'wins');
  const losses = coerceInteger(payload.losses, 'losses');
  const gamesPlayed = wins + losses;
  const winPct = gamesPlayed ? Number((wins / gamesPlayed).toFixed(3)) : 0;
  const pointsPerGame = coerceNumber(payload.pointsPerGame, 'pointsPerGame', { min: 0, max: 200, decimals: 2 });
  const pointsAllowedPerGame = coerceNumber(payload.pointsAllowedPerGame, 'pointsAllowedPerGame', {
    min: 0,
    max: 200,
    decimals: 2
  });
  const reboundsPerGame = coerceNumber(payload.reboundsPerGame, 'reboundsPerGame', {
    min: 0,
    max: 100,
    decimals: 2
  });
  const assistsPerGame = coerceNumber(payload.assistsPerGame, 'assistsPerGame', {
    min: 0,
    max: 100,
    decimals: 2
  });
  const recentForm = coerceNumber(payload.recentForm, 'recentForm', { min: 0, max: 1, decimals: 3 });

  const rows = await query(
    `
      UPDATE team_stats
      SET
        wins = ?,
        losses = ?,
        games_played = ?,
        win_pct = ?,
        points_per_game = ?,
        points_allowed_per_game = ?,
        rebounds_per_game = ?,
        assists_per_game = ?,
        recent_form = ?,
        last_synced_at = NOW()
      WHERE team_id = ?
    `,
    [
      wins,
      losses,
      gamesPlayed,
      winPct,
      pointsPerGame,
      pointsAllowedPerGame,
      reboundsPerGame,
      assistsPerGame,
      recentForm,
      normalizedTeamId
    ]
  );

  if (!rows.affectedRows) {
    throw new Error('Squadra non trovata.');
  }

  const teams = await getTeams();
  return teams.find((team) => Number(team.id) === normalizedTeamId) ?? null;
}

export async function updateGame(gameId, payload) {
  await ensureWritableDatabase();

  const normalizedGameId = coerceInteger(gameId, 'gameId', { min: 1 });
  const homeScore = coerceInteger(payload.homeScore, 'homeScore', { min: 0, max: 250 });
  const awayScore = coerceInteger(payload.awayScore, 'awayScore', { min: 0, max: 250 });
  const arena = String(payload.arena || '').trim();
  const rawStatus = String(payload.status || '').trim();
  const status = homeScore > 0 || awayScore > 0 ? 'Final' : rawStatus || 'Scheduled';

  let datetimeUtc = null;
  if (payload.datetimeUtc) {
    const parsed = new Date(payload.datetimeUtc);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Data/ora partita non valida.');
    }
    datetimeUtc = parsed.toISOString().slice(0, 19).replace('T', ' ');
  }

  const gameDate = datetimeUtc ? datetimeUtc.slice(0, 10) : null;
  const rows = await query(
    `
      UPDATE games
      SET
        home_score = ?,
        away_score = ?,
        status = ?,
        arena = ?,
        datetime_utc = COALESCE(?, datetime_utc),
        game_date = COALESCE(?, game_date),
        period = CASE WHEN ? = 'Final' THEN 4 ELSE period END,
        clock = CASE WHEN ? = 'Final' THEN 'Final' ELSE NULL END
      WHERE id = ?
    `,
    [
      homeScore,
      awayScore,
      status,
      arena || null,
      datetimeUtc,
      gameDate,
      status,
      status,
      normalizedGameId
    ]
  );

  if (!rows.affectedRows) {
    throw new Error('Partita non trovata.');
  }

  const games = await getGames();
  return games.find((game) => Number(game.id) === normalizedGameId) ?? null;
}

export async function predictGame(homeTeamId, awayTeamId) {
  const data = await getData();
  const homeTeam = withTeam(data, homeTeamId);
  const awayTeam = withTeam(data, awayTeamId);
  const homeStats = withStats(data, homeTeamId);
  const awayStats = withStats(data, awayTeamId);

  if (!homeTeam || !awayTeam || !homeStats || !awayStats) {
    throw new Error('Dati insufficienti per calcolare la previsione.');
  }

  const homeRating =
    homeStats.winPct * 40 +
    homeStats.pointsPerGame * 0.22 +
    homeStats.reboundsPerGame * 0.18 +
    homeStats.assistsPerGame * 0.2 +
    homeStats.recentForm * 12 +
    2.5;

  const awayRating =
    awayStats.winPct * 40 +
    awayStats.pointsPerGame * 0.22 +
    awayStats.reboundsPerGame * 0.18 +
    awayStats.assistsPerGame * 0.2 +
    awayStats.recentForm * 12;

  const total = homeRating + awayRating;
  const homeWinProbability = Number(((homeRating / total) * 100).toFixed(1));
  const awayWinProbability = Number((100 - homeWinProbability).toFixed(1));
  const expectedHomeScore = Math.round((homeStats.pointsPerGame + awayStats.pointsAllowedPerGame) / 2 + 2);
  const expectedAwayScore = Math.round((awayStats.pointsPerGame + homeStats.pointsAllowedPerGame) / 2);

  return {
    homeTeam,
    awayTeam,
    homeWinProbability,
    awayWinProbability,
    expectedScore: `${expectedHomeScore} - ${expectedAwayScore}`,
    edgeDescription:
      homeWinProbability > awayWinProbability
        ? `Leggero vantaggio ${homeTeam.abbreviation}`
        : awayWinProbability > homeWinProbability
          ? `Leggero vantaggio ${awayTeam.abbreviation}`
          : 'Match equilibrato',
    modelInputs: {
      home: homeStats,
      away: awayStats
    }
  };
}

export async function login(email, password) {
  if (isDatabaseConfigured()) {
    if (!(await canUseDatabase())) {
      throw new Error('Database MySQL configurato ma non raggiungibile.');
    }

    const user = await findDatabaseUserByEmail(email);

    if (!user) {
      return null;
    }

    return user.password === password ? sanitizeDatabaseUser(user) : null;
  }

  const user = findUserByEmail(email);
  if (!user) {
    return null;
  }

  return verifyPassword(user, password) ? sanitizeUser(user) : null;
}

export async function getCurrentUser(authUser) {
  const record = await findManagedUserByEmail(authUser?.email);

  if (!record) {
    throw new Error('Utente non trovato.');
  }

  return sanitizeManagedUser(record);
}

export async function updateCurrentUser(authUser, payload = {}) {
  const record = await findManagedUserByEmail(authUser?.email);

  if (!record) {
    throw new Error('Utente non trovato.');
  }

  const cleanName = String(payload.name || '').trim();
  const currentPassword = String(payload.currentPassword || '');
  const newPassword = String(payload.newPassword || '');

  if (!cleanName || cleanName.length < 2) {
    throw new Error('Inserisci un nome valido.');
  }

  if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
    throw new Error('Per cambiare password inserisci sia quella attuale sia quella nuova.');
  }

  if (newPassword && newPassword.length < 8) {
    throw new Error('La nuova password deve contenere almeno 8 caratteri.');
  }

  if (record.source === 'database') {
    if (newPassword && record.user.password !== currentPassword) {
      throw new Error('La password attuale non e corretta.');
    }

    const updatedUser = await updateDatabaseUserProfile(record.user.email, {
      name: cleanName,
      password: newPassword || record.user.password
    });

    return sanitizeDatabaseUser(updatedUser);
  }

  if (record.user.provider === 'google' && newPassword) {
    throw new Error('Gli account Google non possono cambiare la password da questa pagina.');
  }

  if (newPassword && !verifyPassword(record.user, currentPassword)) {
    throw new Error('La password attuale non e corretta.');
  }

  const updatedUser = updateLocalUser(record.user.email, {
    name: cleanName,
    password: newPassword || undefined
  });

  return sanitizeUser(updatedUser);
}

export async function register({ name, email, password }) {
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password || '');

  if (!cleanName || cleanName.length < 2) {
    throw new Error('Inserisci un nome valido.');
  }

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Inserisci una email valida.');
  }

  if (cleanPassword.length < 8) {
    throw new Error('La password deve contenere almeno 8 caratteri.');
  }

  if (isDatabaseConfigured()) {
    if (!(await canUseDatabase())) {
      throw new Error('Database MySQL configurato ma non raggiungibile.');
    }

    const existingUser = await findDatabaseUserByEmail(cleanEmail);

    if (existingUser) {
      throw new Error('Esiste già un account con questa email.');
    }

    const user = await createDatabaseUser({
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword
    });

    return sanitizeDatabaseUser(user);
  }

  const user = createLocalUser({ name: cleanName, email: cleanEmail, password: cleanPassword });
  return sanitizeUser(user);
}

export async function loginWithGoogle(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('Google login non configurato sul server.');
  }

  if (!credential) {
    throw new Error('Credenziale Google mancante.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: clientId
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.email_verified) {
    throw new Error('Google non ha restituito una email verificata.');
  }

  const user = upsertGoogleUser({
    email: payload.email,
    name: payload.name,
    avatar: payload.picture,
    googleSub: payload.sub
  });

  return sanitizeUser(user);
}
