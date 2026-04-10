
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'analisi_nba_secret';

export function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider ?? 'local',
      avatar: user.avatar ?? null
    },
    secret,
    { expiresIn: '8h' }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token mancante.' });
  }

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ message: 'Token non valido.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: "Solo l'amministratore può eseguire questa azione." });
  }
  next();
}
