import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authenticate, createToken, requireAdmin } from './middleware/auth.js';
import { canUseDatabase, isDatabaseConfigured } from './db.js';
import {
  getAdminEditorData,
  getCurrentUser,
  getGames,
  getOverview,
  getPlayers,
  getTeams,
  login,
  loginWithGoogle,
  predictGame,
  register,
  updateCurrentUser,
  updateGame,
  updateTeamStats
} from './services.js';

const app = express();
const port = process.env.PORT || 3001;
const hasGoogleClientId = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'il_tuo_client_id_google'
);

app.use(cors());
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    project: 'Analisi NBA',
    googleLoginConfigured: hasGoogleClientId,
    databaseConfigured: isDatabaseConfigured(),
    databaseConnected: await canUseDatabase()
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    googleLoginEnabled: hasGoogleClientId,
    googleClientId: hasGoogleClientId ? process.env.GOOGLE_CLIENT_ID : null
  });
});

app.get('/api/overview', asyncHandler(async (_req, res) => {
  res.json(await getOverview());
}));

app.get('/api/teams', asyncHandler(async (_req, res) => {
  res.json(await getTeams());
}));

app.get('/api/players', asyncHandler(async (_req, res) => {
  res.json(await getPlayers());
}));

app.get('/api/games', asyncHandler(async (_req, res) => {
  res.json(await getGames());
}));

app.get('/api/predictions', async (req, res) => {
  const { homeTeamId, awayTeamId } = req.query;

  if (!homeTeamId || !awayTeamId) {
    return res.status(400).json({ message: 'Servono homeTeamId e awayTeamId.' });
  }

  try {
    return res.json(await predictGame(homeTeamId, awayTeamId));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await login(email, password);

  if (!user) {
    return res.status(401).json({ message: 'Credenziali non valide.' });
  }

  const token = createToken(user);
  return res.json({ token, user });
});

app.post('/api/register', async (req, res) => {
  try {
    const user = await register(req.body || {});
    const token = createToken(user);
    return res.status(201).json({ token, user, message: 'Registrazione completata con successo.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const user = await loginWithGoogle(req.body?.credential);
    const token = createToken(user);
    return res.json({ token, user, message: 'Accesso con Google completato.' });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Login Google non riuscito.' });
  }
});

app.get('/api/me', authenticate, asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user);
  res.json({ user });
}));

app.put('/api/me', authenticate, asyncHandler(async (req, res) => {
  const user = await updateCurrentUser(req.user, req.body || {});
  const token = createToken(user);
  res.json({
    token,
    user,
    message: 'Profilo aggiornato con successo.'
  });
}));

app.get('/api/admin/status', authenticate, requireAdmin, (req, res) => {
  res.json({
    message: 'Area amministratore attiva. Solo l\'admin puo modificare i dati sportivi.',
    user: req.user
  });
});

app.get('/api/admin/editor', authenticate, requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await getAdminEditorData());
}));

app.put('/api/admin/teams/:teamId/stats', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const team = await updateTeamStats(req.params.teamId, req.body || {});
  res.json({
    message: 'Statistiche squadra aggiornate.',
    team
  });
}));

app.put('/api/admin/games/:gameId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const game = await updateGame(req.params.gameId, req.body || {});
  res.json({
    message: 'Partita aggiornata.',
    game
  });
}));

app.listen(port, () => {
  console.log(`Analisi NBA backend attivo su http://localhost:${port}`);
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    message: error.message || 'Errore interno del server.'
  });
});
