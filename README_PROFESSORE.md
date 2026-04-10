# README Professore

## Avvio

Installazione iniziale:

```bash
cd backend
copy .env.example .env
npm install
```

```bash
cd frontend
copy .env.example .env
npm install
```

Avvio dalla root:

```bash
npm start
```

Applicazione disponibile su `http://localhost:5173`.

## Modalita Di Default

Se il database MySQL non e configurato, il backend usa automaticamente lo snapshot locale incluso nel progetto.

## Modalita MySQL

Nel repository sono inclusi anche gli script SQL del database, nella cartella `database/`.

Per l'esecuzione con database:

- creare `analisi_nba`
- eseguire `database/schema.sql`
- eseguire `database/live_upgrade.sql`
- valorizzare i campi DB in `backend/.env`

## Credenziali Demo

- `admin@analisinba.local / admin123`
- `viewer@analisinba.local / viewer123`

## Note

- Google login opzionale
- il progetto e avviabile anche senza servizi esterni
- la modalita piu immediata per la verifica e quella con snapshot locale
- il repository contiene frontend, backend, script SQL e script di data engineering
