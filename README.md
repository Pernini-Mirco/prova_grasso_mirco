# Analisi NBA

Piattaforma di sport analytics con frontend React + Vite, backend Node.js + Express e supporto MySQL.

## Cosa Trovera Chi Scarica Il Progetto

Il progetto puo essere avviato in due modi:

1. `Modalita snapshot locale`
   L'app parte anche senza MySQL e mostra il dataset locale incluso nel repository.
2. `Modalita MySQL completa`
   L'app legge i dati dal database MySQL e puo usare anche la sync live.

Quindi chi scarica il progetto non resta bloccato: senza database vede comunque il sito funzionante, con database configurato vede la versione completa.

Per una guida ancora piu rapida pensata per la correzione, vedere anche `README_PROFESSORE.md`.

## Funzionalita Principali

- dashboard statistiche NBA
- pagine squadre, giocatori e partite
- prediction center per il confronto tra squadre
- confronto giocatori head to head
- autenticazione locale e Google login opzionale
- area amministratore per modificare dati
- script di data engineering e sync dati

## Requisiti

- Node.js 20+ consigliato
- npm
- MySQL 8 facoltativo ma consigliato per la modalita completa

## Avvio Rapido Consigliato

### Avvio Unico

Dopo avere eseguito `npm install` una volta dentro `backend` e `frontend`, dalla root del progetto puoi avviare tutto con:

```bash
npm start
```

Il comando lancia insieme:

- backend su `http://localhost:3001`
- frontend su `http://localhost:5173`

### Backend

```bash
cd backend
copy .env.example .env
npm install
npm start
```

Backend disponibile su `http://localhost:3001`.

### Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend disponibile su `http://localhost:5173`.

## Modalita Snapshot Locale

Non richiede MySQL.

Se in `backend/.env` lasci vuoti i campi `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`, il backend usera automaticamente lo snapshot locale incluso nel progetto.

Questa e la modalita piu semplice per la correzione o la demo veloce.

## Modalita MySQL Completa

Se vuoi vedere il progetto nella versione completa con database:

1. crea il database MySQL `analisi_nba`
2. esegui `database/schema.sql`
3. esegui `database/live_upgrade.sql`
4. compila in `backend/.env` questi campi:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=analisi_nba
```

Poi avvia il backend con:

```bash
cd backend
npm start
```

## Sync Dati Live Opzionale

Per la sync online servono:

- una API key `balldontlie`
- i campi corretti in `backend/.env`

Esempio:

```env
BALLDONTLIE_API_KEY=...
NBA_SYNC_SEASONS=2025
BALLDONTLIE_PLAN=free
BALLDONTLIE_REQUEST_INTERVAL_MS=15000
BALLDONTLIE_FETCH_STATS=false
```

Esecuzione:

```bash
cd backend
npm run sync:live
```

## Login Demo

- `admin@analisinba.local / admin123`
- `viewer@analisinba.local / viewer123`

## Google Login Opzionale

Compilare:

- `backend/.env` -> `GOOGLE_CLIENT_ID=...`
- `frontend/.env` -> `VITE_GOOGLE_CLIENT_ID=...`

Se i campi restano vuoti, il sito funziona comunque senza Google login.

## Struttura Repository

- `frontend/` -> applicazione React + Vite
- `backend/` -> API Express, autenticazione, logica dati
- `database/` -> script SQL
- `data-engineering/` -> script lato raccolta dati
- `docs/` -> documentazione di supporto

## Nota Per La Pubblicazione Su GitHub

Il repository e predisposto per non caricare:

- `.env`
- `node_modules`
- `dist`
- file di log

Vanno pubblicati invece:

- codice frontend
- codice backend
- script SQL
- script di data engineering
- `.env.example`

## Risultato Atteso Per Il Professore

- se clona il progetto e segue l'avvio rapido, l'app parte senza problemi in modalita snapshot locale
- se configura anche MySQL, vedra la versione completa con dati dal database

Quindi il progetto e adesso molto piu sicuro da pubblicare su GitHub senza sorprese.
