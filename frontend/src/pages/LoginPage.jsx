import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../api.js';
import PageHeader from '../components/PageHeader.jsx';

const defaultLogin = { email: 'admin@analisinba.local', password: 'admin123' };
const defaultRegister = { name: '', email: '', password: '', confirmPassword: '' };
const defaultProfile = { name: '', currentPassword: '', newPassword: '', confirmPassword: '' };

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

export default function LoginPage({ onAuth, onLogout, session }) {
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(defaultLogin);
  const [registerForm, setRegisterForm] = useState(defaultRegister);
  const [profileForm, setProfileForm] = useState(defaultProfile);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    setProfileForm({
      name: session.user.name || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setMessage('');
  }, [session?.user?.email, session?.user?.name]);

  const googleEnabled = useMemo(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    return Boolean(clientId);
  }, []);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      onAuth(payload);
      setMessage('Login effettuato con successo.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setLoading(false);
      setMessage('Le password non coincidono.');
      return;
    }

    try {
      const payload = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password
        })
      });
      onAuth(payload);
      setRegisterForm(defaultRegister);
      setMessage('Registrazione completata: sei gia autenticato.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitProfileUpdate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (profileForm.newPassword !== profileForm.confirmPassword) {
      setLoading(false);
      setMessage('Le nuove password non coincidono.');
      return;
    }

    try {
      const payload = await api('/api/me', {
        method: 'PUT',
        authToken: session.token,
        body: JSON.stringify({
          name: profileForm.name,
          currentPassword: profileForm.currentPassword,
          newPassword: profileForm.newPassword
        })
      });
      onAuth(payload);
      setProfileForm((current) => ({
        ...current,
        name: payload.user.name,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setMessage(payload.message || 'Profilo aggiornato con successo.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    setMessage('');
    try {
      const payload = await api('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      onAuth(payload);
      setMessage('Accesso con Google completato con successo.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (session?.user) {
    const isGoogleUser = session.user.provider === 'google';

    return (
      <div className="page-stack auth-page account-page">
        <PageHeader
          eyebrow="Account"
          title="Profilo utente"
          subtitle="Gestisci identita, sicurezza e informazioni del tuo account."
        />

        <section className="account-overview-grid">
          <article className="panel auth-support-card account-profile-card">
            <div className="account-avatar">{getInitials(session.user.name)}</div>
            <div className="account-profile-copy">
              <p className="mini-label">Sessione attiva</p>
              <h3>{session.user.name}</h3>
              <p className="helper">{session.user.email}</p>
            </div>
            <div className="status-box account-status-box">
              <p>Ruolo: <strong>{session.user.role}</strong></p>
              <p>Provider: <strong>{session.user.provider}</strong></p>
              <p>Account: <strong>{isGoogleUser ? 'Google collegato' : 'Locale'}</strong></p>
            </div>
          </article>

          <article className="panel auth-support-card">
            <p className="mini-label">Gestione account</p>
            <h3>Area personale</h3>
            <p className="helper">
              Dopo l'accesso non vengono piu mostrati login e registrazione: questa pagina diventa il tuo pannello profilo.
            </p>
            <div className="account-badge-row">
              <span className="status-pill live-pill">Account attivo</span>
              <span className="status-pill muted-pill">{session.user.role}</span>
              <span className="status-pill muted-pill">{session.user.provider}</span>
            </div>
            <div className="auth-session-actions">
              <button type="button" className="secondary-button" onClick={onLogout}>
                Logout
              </button>
            </div>
          </article>
        </section>

        <section className="auth-shell auth-shell-compact panel glow-card">
          <div className="auth-card auth-card-full account-editor-card">
            <div className="panel-head account-editor-head">
              <div>
                <p className="mini-label">Profile editor</p>
                <h3>I tuoi dati</h3>
              </div>
              <p className="helper">
                Aggiorna il nome visualizzato e, se usi un account locale, cambia anche la password.
              </p>
            </div>

            <form className="form-panel auth-form account-form" onSubmit={submitProfileUpdate}>
              <div className="account-field-grid">
                <label>
                  Nome completo
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Inserisci il tuo nome"
                  />
                </label>

                <label className="readonly-field">
                  Email
                  <input value={session.user.email} readOnly disabled />
                </label>

                <label className="readonly-field">
                  Ruolo
                  <input value={session.user.role} readOnly disabled />
                </label>

                <label className="readonly-field">
                  Provider
                  <input value={session.user.provider} readOnly disabled />
                </label>
              </div>

              {isGoogleUser ? (
                <div className="state-box account-note-box">
                  <p className="mini-label">Sicurezza</p>
                  <p className="helper">
                    Questo account usa Google come provider. Da qui puoi modificare il nome profilo, mentre la password resta gestita da Google.
                  </p>
                </div>
              ) : (
                <div className="account-password-grid">
                  <label>
                    Password attuale
                    <input
                      type="password"
                      value={profileForm.currentPassword}
                      onChange={(event) => setProfileForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      placeholder="Necessaria solo se la cambi"
                    />
                  </label>

                  <label>
                    Nuova password
                    <input
                      type="password"
                      value={profileForm.newPassword}
                      onChange={(event) => setProfileForm((current) => ({ ...current, newPassword: event.target.value }))}
                      placeholder="Almeno 8 caratteri"
                    />
                  </label>

                  <label>
                    Conferma nuova password
                    <input
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(event) => setProfileForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      placeholder="Ripeti la nuova password"
                    />
                  </label>
                </div>
              )}

              {message ? <p className="helper auth-message">{message}</p> : null}

              <div className="account-actions">
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
                <button type="button" className="secondary-button" onClick={onLogout}>
                  Logout
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack auth-page">
      <PageHeader
        eyebrow="Account"
        title="Accesso"
        subtitle="Accedi alla piattaforma o crea il tuo spazio personale."
      />

      <section className="auth-shell auth-shell-compact panel glow-card">
        <div className="auth-card auth-card-full">
          <div className="auth-tabs">
            <button
              type="button"
              className={`tab-button ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setMessage('');
              }}
            >
              Accedi
            </button>
            <button
              type="button"
              className={`tab-button ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setMessage('');
              }}
            >
              Registrati
            </button>
          </div>

          {message ? <p className="helper auth-message auth-form-message">{message}</p> : null}

          {mode === 'login' ? (
            <form className="form-panel auth-form" onSubmit={submitLogin}>
              <label>
                Email
                <input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="nome@email.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Inserisci la password"
                />
              </label>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </form>
          ) : (
            <form className="form-panel auth-form" onSubmit={submitRegister}>
              <label>
                Nome completo
                <input
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Francesco Rossi"
                />
              </label>
              <label>
                Email
                <input
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="nome@email.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Almeno 8 caratteri"
                />
              </label>
              <label>
                Conferma password
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="Ripeti la password"
                />
              </label>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Creazione account...' : 'Crea account'}
              </button>
            </form>
          )}

          <div className="auth-divider"><span>oppure</span></div>

          {googleEnabled ? (
            <div className="google-box">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setMessage('Accesso Google annullato o non riuscito.')}
                shape="pill"
                text={mode === 'register' ? 'signup_with' : 'signin_with'}
                theme="filled_black"
                size="large"
                width="100%"
              />
            </div>
          ) : (
            <div className="google-placeholder">
              <p className="helper">
                Google login non disponibile in questo ambiente.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="auth-support-grid">
        <article className="panel auth-support-card">
          <p className="mini-label">Credenziali demo</p>
          <h3>Admin</h3>
          <p><strong>Email:</strong> admin@analisinba.local</p>
          <p><strong>Password:</strong> admin123</p>
        </article>

        <article className="panel auth-support-card">
          <p className="mini-label">Area utente</p>
          <h3>Profilo dedicato dopo il login</h3>
          <p className="helper">
            Una volta autenticato non vedrai piu login e registrazione qui: la pagina diventa il tuo pannello account con modifica dati e logout.
          </p>
        </article>
      </section>
    </div>
  );
}
