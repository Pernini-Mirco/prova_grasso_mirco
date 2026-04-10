# Relazione Tecnica - Analisi NBA

## Frontespizio

- Titolo progetto: `Analisi NBA - Piattaforma di sport analytics`
- Autore: `[inserire nome studente]`
- Classe: `[inserire classe]`
- Data: `[inserire data consegna]`

## 1. Introduzione E Descrizione Del Problema

L'obiettivo del progetto e la realizzazione di una piattaforma web di sport analytics dedicata al campionato NBA.
L'applicazione consente di consultare dati relativi a squadre, giocatori e partite, di confrontare atleti tra loro e di stimare l'esito probabile di un matchup tra due franchigie.

Il sistema e stato sviluppato come applicazione full stack:

- frontend in React + Vite
- backend in Node.js + Express
- database relazionale in MySQL
- script di data engineering per il reperimento e l'aggiornamento dei dati

Il progetto e stato pensato per rispondere ai requisiti della consegna:

- dashboard sportiva con visualizzazione dati
- backend per analisi e previsione
- database MySQL
- gestione utenti
- vincolo amministratore
- pubblicazione del progetto su GitHub

## 2. Funzionalita Realizzate

Le funzionalita principali sviluppate sono:

- dashboard generale con overview di lega, leader statistici e risultati recenti
- pagina squadre con schede sintetiche e popup di dettaglio
- pagina giocatori con lista, immagini, confronto `head to head` e filtri
- pagina partite con risultati e prossime gare
- pagina predizioni con confronto tra due squadre e analisi del matchup
- ricerca interna
- autenticazione con login locale
- supporto opzionale al login Google
- area profilo utente
- area amministratore per modificare dati

## 3. Progettazione Dell'Interfaccia E Mappa Applicativa

La UI e stata progettata come dashboard moderna a tema sportivo professionale, con sidebar laterale fissa e pagine dedicate.

Mappa applicativa:

- `Dashboard`
- `Squadre`
- `Giocatori`
- `Partite`
- `Predizioni`
- `Ricerca`
- `Login / Profilo`
- `Admin` visibile solo all'utente amministratore

Scelte principali di interfaccia:

- layout scuro ad alto contrasto
- uso di loghi e foto giocatori
- popup di dettaglio per evitare cambi pagina non necessari
- menu personalizzati per la selezione di squadre e giocatori
- micro-animazioni per migliorare la percezione di qualita

## 4. Progettazione Database

Il database e stato implementato in MySQL.

Tabelle principali:

- `teams`
- `team_stats`
- `players`
- `games`
- `users`
- `player_game_stats` nella versione estesa live

Relazioni principali:

- una squadra ha molti giocatori
- una squadra ha molte partite come casa
- una squadra ha molte partite come ospite
- una squadra ha una scheda statistica aggregata
- gli utenti sono gestiti separatamente per autenticazione e ruoli

Documenti SQL inclusi nel progetto:

- `database/schema.sql`
- `database/live_upgrade.sql`

Lo schema e stato mantenuto relazionale e semplice da consultare, in modo coerente con i requisiti della consegna.

## 5. Descrizione Dell'Algoritmo Di Analisi

L'algoritmo principale implementato riguarda la previsione dell'esito di una partita.

Input principali utilizzati:

- punti per gara
- punti concessi
- rimbalzi
- assist
- forma recente
- vantaggio del fattore campo

Output prodotti:

- probabilita di vittoria squadra di casa
- probabilita di vittoria squadra ospite
- punteggio atteso
- descrizione sintetica del vantaggio
- indicatori principali che guidano il risultato previsto

L'algoritmo non vuole simulare un motore predittivo professionale ufficiale, ma fornire una stima motivata e leggibile a partire dalle statistiche disponibili.

## 6. Procedura Di Data Engineering

La parte di data engineering e stata sviluppata per:

- reperire dati online da API pubbliche
- pulire e normalizzare i campi ricevuti
- filtrare le squadre non desiderate
- completare i campi mancanti con fallback locali
- salvare il risultato nel database MySQL

Sono presenti inoltre:

- snapshot locale per avvio rapido senza DB
- snapshot generato per completare dati mancanti dei giocatori
- archivio dei giocatori verificati con immagini locali

Questa soluzione ha permesso di mantenere il progetto avviabile anche in assenza di servizi esterni o chiavi API.

## 7. Backend Ed Endpoint

Il backend Express espone endpoint per:

- overview dashboard
- squadre
- giocatori
- partite
- predizioni
- autenticazione
- profilo utente
- area amministratore

Sono presenti controlli di errore e controllo ruolo, in particolare:

- solo l'amministratore puo accedere alle rotte admin
- il backend puo lavorare sia con MySQL sia con snapshot locale
- in caso di database non disponibile viene gestita una modalita fallback

## 8. Gestione Utenti

Sono stati gestiti diversi tipi di utente:

- `admin`
- `viewer`

Vincolo fondamentale rispettato:

- solo l'utente amministratore puo modificare i dati tramite area admin e relativi endpoint protetti

Per gli utenti autenticati e disponibile anche una pagina profilo in cui consultare e modificare i propri dati principali.

## 9. Problemi Riscontrati Durante Lo Sviluppo

Durante il progetto sono emersi diversi problemi tecnici e progettuali.

### 9.1 Problemi Di Struttura Frontend

- import errati o percorsi non coerenti tra componenti e pagine
- asset mancanti per immagini di giocatori e loghi squadra
- menu a tendina nativi poco leggibili nel tema scuro
- allineamenti non corretti in dashboard e prediction page
- popup di dettaglio ancorati alla pagina scrollabile invece che al viewport

Soluzioni adottate:

- correzione dei path di import
- creazione e collegamento di asset locali
- sostituzione dei `select` standard con menu custom
- rifinitura del CSS con griglie piu stabili
- uso di portal per i popup modali

### 9.2 Problemi Di Qualita Visiva

- il sito risultava inizialmente troppo simile a una demo
- alcuni spazi erano eccessivi o sbilanciati
- la top bar interferiva con lo scroll della pagina
- la prediction room presentava elementi sovrapposti o fuori viewport

Soluzioni adottate:

- redesign completo del tema visivo
- revisione degli spazi e delle gerarchie tipografiche
- semplificazione della barra superiore
- adattamento responsive e riduzione delle larghezze critiche

### 9.3 Problemi Sulle Immagini Dei Giocatori

- mancavano molte foto reali
- alcuni placeholder risultavano poco professionali
- non tutti i giocatori avevano asset coerenti

Soluzioni adottate:

- download e associazione di immagini locali
- verifica dell'esistenza di immagini ufficiali
- uso di snapshot generati per completare i buchi
- mantenimento di un archivio locale riutilizzabile anche dopo esportazione del progetto

### 9.4 Problemi Di Integrazione Database

- passaggio da snapshot locale a MySQL non immediato
- registrazione utente che in alcuni casi continuava a salvare nel file locale
- rischio di mostrare dati diversi tra ambiente locale e database
- file `.env` e configurazioni locali non pronti per la pubblicazione

Soluzioni adottate:

- creazione del file di connessione MySQL
- aggiornamento dei servizi backend per leggere dal database
- correzione della logica di registrazione utente
- preparazione di `.env.example`
- introduzione di `.gitignore` e documentazione per GitHub

### 9.5 Problemi Con I Dati Online

- limiti del piano gratuito di `balldontlie`
- errori `401 Unauthorized` in caso di chiave non valida
- errori `429 Too many requests` a causa del rate limit
- endpoint non disponibili nel piano free
- dataset live contenente squadre extra o dati incompleti

Soluzioni adottate:

- rallentamento delle richieste
- retry automatici
- filtro alle 30 franchigie NBA desiderate
- fusione tra dati live e snapshot locale per riempire i campi mancanti
- deduzione locale di alcune informazioni non restituite dall'API

### 9.6 Problemi Sui Dati Partite

- partite senza punteggio visibile
- status non uniformi
- campi arena mancanti

Soluzioni adottate:

- distinzione tra gare concluse e programmate
- normalizzazione dello stato della partita
- deduzione dell'arena in base alla squadra di casa

### 9.7 Problemi Di Deploy E Consegna

- assenza iniziale del repository Git locale
- mancanza di `.gitignore`
- rischio di pubblicare `.env`, `node_modules` o build locali
- documentazione iniziale troppo scarna

Soluzioni adottate:

- inizializzazione del repository Git
- creazione di `.gitignore`
- stesura di `README.md`
- stesura di `README_PROFESSORE.md`

## 10. Risultato Finale

Il risultato finale e una piattaforma web funzionante e navigabile, con:

- interfaccia moderna
- supporto sia snapshot sia MySQL
- area amministratore
- sistema di autenticazione
- predizione matchup
- consultazione di squadre, giocatori e partite

Il progetto e stato inoltre reso piu robusto per la consegna su GitHub, cosi da poter essere eseguito anche su una macchina differente da quella di sviluppo.

## 11. Considerazioni Conclusive

Il progetto ha richiesto l'integrazione di piu competenze:

- sviluppo frontend
- sviluppo backend
- gestione database
- pulizia dati
- progettazione UI
- gestione autenticazione
- correzione di problemi di integrazione e deploy

La criticita principale non e stata solo la scrittura del codice, ma la coerenza tra dati, interfaccia, database e documentazione finale.

Il lavoro svolto ha portato a un'applicazione completa, estendibile e coerente con gli obiettivi principali della consegna.
