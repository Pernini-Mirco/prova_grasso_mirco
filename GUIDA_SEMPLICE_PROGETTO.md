# Guida Semplice Del Progetto Dal Punto Di Vista Informatico

Questo file non spiega il progetto dal punto di vista del basket.

Lo spiega dal punto di vista informatico, cioe:

- che tipo di applicazione e
- da quali parti software e composta
- cosa fa ogni parte
- come comunicano tra loro frontend, backend e database

L'obiettivo e far capire il progetto anche a una persona che non e molto esperta di informatica, ma senza parlare solo di "statistiche NBA". Qui il centro e il funzionamento del sistema.

## 1. Che tipo di progetto e

Questo progetto e una `web app full stack`.

In modo molto semplice, significa che non esiste una sola parte del programma, ma piu livelli che lavorano insieme:

- una parte grafica che l'utente vede e usa
- una parte logica che elabora richieste e dati
- una parte che conserva i dati in modo ordinato
- una parte che puo recuperare dati dall'esterno e prepararli

Queste quattro aree sono:

- `frontend`
- `backend`
- `database`
- `data engineering`

## 2. Idea generale del funzionamento

Il funzionamento generale del progetto e questo:

1. l'utente apre una pagina del sito
2. il frontend capisce quale pagina mostrare
3. il frontend chiede i dati al backend
4. il backend recupera i dati dal database oppure da uno snapshot locale
5. il backend restituisce i dati al frontend
6. il frontend li mostra in modo leggibile

Quindi il frontend non inventa i dati da solo.
Li richiede al backend.
Il backend, a sua volta, e il livello che decide dove prendere i dati e come organizzarli.

## 3. Frontend: la parte visibile

Il frontend e stato sviluppato con `React`.

React serve per costruire interfacce web moderne dividendole in componenti riutilizzabili.

Nel progetto il frontend si occupa di:

- mostrare le pagine
- gestire la navigazione tra le pagine
- fare richieste al backend
- salvare alcune informazioni locali, come la sessione utente
- aggiornare automaticamente alcune sezioni
- gestire ricerca, filtri, selezioni e confronti

In pratica:

- il frontend e la parte che "parla con l'utente"
- il backend e la parte che "parla con i dati"

### Navigazione

Il progetto usa un sistema di routing lato client.

Questo significa che il sito ha piu sezioni, ma si comporta come una singola applicazione.
Quando l'utente cambia pagina, non viene ricaricato tutto il sito da zero.
Si aggiorna solo la parte centrale.

Le rotte principali sono in [App.jsx](c:/Users/francesco/Desktop/analisi-nba-google/frontend/src/App.jsx).

Le pagine principali sono:

- Dashboard
- Squadre
- Giocatori
- Partite
- Predizioni
- Ricerca
- Login / Profilo
- Admin

### Componenti

Nel frontend non e tutto scritto in un solo file.

Ci sono componenti separati, per esempio:

- header di pagina
- card KPI
- loader
- grafici
- modali di dettaglio

Questo approccio e utile perche:

- il codice e piu ordinato
- si evita di ripetere la stessa logica piu volte
- ogni pezzo ha una responsabilita precisa

### Stato del frontend

Il frontend tiene in memoria alcune informazioni temporanee, ad esempio:

- dati ricevuti dal backend
- filtri selezionati
- utente loggato
- form compilati
- selezioni attive nei confronti

Queste informazioni non sono il database vero e proprio.
Sono solo dati utili mentre l'utente sta usando l'app.

## 4. Backend: la parte logica

Il backend e sviluppato con `Node.js` e `Express`.

Il backend e il livello che riceve le richieste del frontend e risponde.

Per esempio:

- il frontend chiede l'elenco delle squadre
- il backend legge i dati
- il backend restituisce un JSON con le squadre

### Cosa fa il backend

Il backend si occupa di:

- esporre endpoint API
- leggere dati dal database
- usare uno snapshot locale se il database non e disponibile
- validare i dati ricevuti
- gestire login, registrazione e profilo
- controllare i permessi utente
- eseguire l'algoritmo di previsione

In altre parole, il backend e il "cervello operativo" dell'applicazione.

### Endpoint API

Il backend espone varie rotte API, ad esempio:

- `/api/overview`
- `/api/teams`
- `/api/players`
- `/api/games`
- `/api/predictions`
- `/api/login`
- `/api/register`
- `/api/me`
- `/api/admin/...`

Queste rotte si vedono in [server.js](c:/Users/francesco/Desktop/analisi-nba-google/backend/src/server.js).

Un endpoint API e semplicemente un indirizzo a cui il frontend puo fare una richiesta per ottenere o modificare dati.

### Business logic

Nel file dei servizi backend si trova la logica applicativa principale.

Questo livello decide:

- come costruire l'overview della dashboard
- come unire squadre e statistiche
- come preparare i dati di giocatori e partite
- come aggiornare i dati admin
- come calcolare la previsione

Questo approccio e importante perche separa:

- il file che definisce le rotte
- il file che contiene la vera logica del progetto

Questa separazione rende il codice piu pulito e piu facile da mantenere.

## 5. Database: la memoria permanente

Il database usato e `MySQL`.

Il database serve a conservare i dati in modo stabile e ordinato.
Se chiudi il sito e lo riapri, i dati restano li.

### Tabelle principali

Le tabelle principali sono:

- `teams`
- `team_stats`
- `players`
- `games`
- `users`
- `player_game_stats`

Gli script SQL sono in:

- [schema.sql](c:/Users/francesco/Desktop/analisi-nba-google/database/schema.sql)
- [live_upgrade.sql](c:/Users/francesco/Desktop/analisi-nba-google/database/live_upgrade.sql)

### Perche usare un database

Senza database, il sito potrebbe solo mostrare dati scritti a mano in file statici.

Con il database invece si puo:

- conservare dati strutturati
- cercare informazioni in modo piu preciso
- aggiornare dati senza riscrivere tutto il progetto
- separare meglio contenuto e interfaccia

In parole semplici:

- il frontend mostra
- il backend decide
- il database conserva

## 6. Modalita fallback: snapshot locale

Una scelta importante del progetto e che puo funzionare anche senza MySQL attivo.

Se il database non e configurato, il backend usa uno `snapshot locale`.

Questo significa che esiste una copia dei dati gia salvata nel repository.

Perche e utile:

- il progetto parte anche in demo
- non dipende sempre da una configurazione esterna
- e piu facile da mostrare al professore

Questa e una scelta tecnica utile per rendere il progetto piu robusto.

In informatica si parla spesso di `fallback`, cioe una soluzione di riserva quando la soluzione principale non e disponibile.

## 7. Data engineering: raccolta e preparazione dati

Questa parte non riguarda la grafica del sito.

Riguarda il lavoro fatto sui dati prima che arrivino all'utente.

Il progetto include script che servono per:

- recuperare dati da una fonte esterna
- leggere piu pagine di risultati
- filtrare solo le squadre corrette
- normalizzare campi con formati diversi
- ricostruire dati mancanti
- salvare tutto nel database

Questa parte e importante perche i dati esterni spesso:

- non sono completi
- non sono uniformi
- non sono gia pronti per il sito

Quindi il data engineering e il passaggio che trasforma "dati grezzi" in "dati usabili".

## 8. Autenticazione e autorizzazione

Molte persone confondono questi due concetti, ma sono diversi.

### Autenticazione

Vuol dire: il sistema verifica chi sei.

Nel progetto avviene con:

- login email/password
- login Google opzionale

### Autorizzazione

Vuol dire: il sistema decide cosa puoi fare.

Nel progetto ci sono almeno due ruoli:

- `viewer`
- `admin`

Il `viewer` puo vedere.
L'`admin` puo vedere e modificare.

### JWT

Dopo il login, il backend genera un token.

Questo token viene usato dal frontend per dimostrare che l'utente e autenticato.
Il token viene inviato nelle richieste protette.

In modo semplice:

- fai login
- il server ti da una "chiave temporanea"
- il frontend usa quella chiave per accedere alle funzioni protette

## 9. Sessione utente nel frontend

Dopo il login, il frontend salva la sessione in `localStorage`.

Questo serve per:

- non perdere subito il login se aggiorni la pagina
- ricordare chi e l'utente attivo
- mostrare l'area admin solo a chi ha ruolo admin

Questa non e sicurezza totale da sola.
La sicurezza vera e controllata dal backend.
Il frontend la usa soprattutto per gestire l'esperienza utente.

## 10. Controllo admin

Una regola importante della consegna e:

- solo l'amministratore puo modificare i dati

Nel progetto questa regola e gestita in due punti:

### Nel frontend

Il link admin compare solo se l'utente ha ruolo admin.

### Nel backend

Le rotte admin sono protette.
Quindi anche se qualcuno provasse a chiamarle manualmente, il server controlla comunque il ruolo.

Questa doppia protezione e una buona pratica:

- il frontend guida l'interfaccia
- il backend impone davvero la regola

## 11. Come leggere le pagine dal punto di vista software

Qui non descriviamo le pagine come sezioni sportive, ma come moduli dell'applicazione.

### Dashboard

Dal punto di vista informatico, la dashboard e una pagina aggregatrice.

Significa che:

- chiama piu endpoint insieme
- unisce dati diversi
- calcola valori derivati nel frontend
- mostra una sintesi iniziale

Questa pagina non salva dati.
Legge, combina e presenta.

### Pagina Squadre

Questa pagina e un modulo di consultazione con:

- caricamento dati
- filtro
- ricerca
- apertura dettaglio in modale

Quindi usa una logica tipica di:

- elenco
- selezione
- dettaglio

### Pagina Giocatori

Questa pagina fa due cose:

- consultazione elenco
- confronto di due elementi

Dal punto di vista software e interessante perche implementa una logica di comparazione tra record diversi.

### Pagina Partite

Questa pagina e una vista dati con:

- filtri
- distinzione tra partite concluse e programmate
- auto-refresh

Quindi e una pagina pensata per dati che possono cambiare nel tempo.

### Pagina Predizioni

Questa pagina usa sia dati letti dal backend sia una logica analitica.

Dal punto di vista informatico e un modulo piu avanzato perche:

- riceve input dall'utente
- invia parametri al backend
- riceve un output calcolato
- mostra spiegazioni e confronti sul risultato

### Pagina Ricerca

Questa pagina e un motore di ricerca interno semplificato.

Non cerca su internet.
Cerca dentro i dati gia caricati del progetto.

### Login / Profilo

Questa parte gestisce:

- accesso
- registrazione
- aggiornamento del profilo
- logout

Quindi e il modulo dedicato all'identita dell'utente.

### Admin

Questa e la parte di editing controllato.

Dal punto di vista software, e l'area in cui si eseguono operazioni di aggiornamento sul database attraverso endpoint protetti.

## 12. Algoritmo di previsione

Dal punto di vista informatico, l'algoritmo e una funzione che:

- riceve dati in ingresso
- applica una logica numerica
- produce un risultato

Nel progetto l'algoritmo usa valori come:

- percentuale vittorie
- punti segnati
- punti subiti
- rimbalzi
- assist
- forma recente
- fattore campo

L'algoritmo trasforma questi numeri in:

- probabilita di vittoria
- punteggio atteso
- descrizione del vantaggio

Questa e una parte importante perche dimostra che il progetto non si limita a leggere dati, ma li elabora.

## 13. Aggiornamento automatico

In alcune pagine il progetto usa un refresh automatico.

Questo significa che, ogni certo intervallo di tempo, il frontend rifa la richiesta al backend.

Perche e utile:

- l'utente vede dati piu aggiornati
- non deve ricaricare la pagina a mano

Questa e una funzione tipica delle web app che mostrano dati dinamici.

## 14. Gestione errori

Una buona applicazione non deve pensare solo al caso ideale.
Deve anche gestire i problemi.

Nel progetto esistono controlli per casi come:

- credenziali sbagliate
- dati mancanti
- parametri non validi
- utente non autorizzato
- database non raggiungibile
- servizi esterni non disponibili

Questo rende il progetto piu stabile e piu realistico.

## 15. Perche il progetto e organizzato cosi

Questa struttura a livelli non e casuale.

Serve per separare le responsabilita:

- il frontend gestisce presentazione e interazione
- il backend gestisce logica e sicurezza
- il database gestisce la persistenza dei dati
- il data engineering gestisce raccolta e preparazione

Questa separazione e importante perche:

- il codice e piu chiaro
- le modifiche sono piu facili
- il progetto cresce meglio
- i problemi si individuano piu facilmente

## 16. Esempio semplice di flusso completo

Facciamo un esempio molto concreto.

L'utente apre la pagina predizioni.

Cosa succede?

1. il frontend mostra la pagina
2. il frontend chiede squadre e partite al backend
3. il backend legge i dati
4. il frontend fa scegliere due squadre
5. il frontend invia `homeTeamId` e `awayTeamId` al backend
6. il backend esegue l'algoritmo
7. il backend restituisce il risultato
8. il frontend mostra probabilita, confronto e spiegazione

Questo esempio fa vedere bene come collaborano i vari livelli.

## 17. Cosa dimostra questo progetto a livello informatico

Dal punto di vista informatico, questo progetto dimostra che sai lavorare su:

- sviluppo frontend con React
- sviluppo backend con Node.js ed Express
- uso di API REST
- gestione utenti e ruoli
- uso di database MySQL
- separazione tra logica, dati e interfaccia
- elaborazione dati tramite algoritmo
- integrazione con fonti esterne

Quindi non e solo un sito con grafica.
E un'applicazione strutturata a piu livelli.

## 18. Riassunto finale molto semplice

Se dovessi spiegare il progetto a una persona non esperta, direi:

Questo progetto e un'applicazione web completa in cui:

- il frontend mostra le pagine e raccoglie le azioni dell'utente
- il backend riceve le richieste e applica la logica del sistema
- il database conserva i dati
- alcuni script recuperano e sistemano i dati dall'esterno

In pratica, e un sistema software completo in miniatura, non solo una pagina web.

## 19. Nota finale

Questo file e pensato come supporto personale.

Puoi usarlo per:

- prepararti a spiegare il progetto a voce
- capire meglio il ruolo di ogni parte
- trasformare piu facilmente queste idee in una relazione piu tecnica

Se vuoi, nel prossimo passaggio posso anche farti una seconda versione ancora piu utile per l'orale:

- molto piu corta
- in stile discorso da 3-4 minuti
- sempre dal punto di vista informatico
