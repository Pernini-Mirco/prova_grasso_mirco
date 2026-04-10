USE analisi_nba;

ALTER TABLE players
  MODIFY position VARCHAR(10) NULL,
  MODIFY age INT NULL,
  MODIFY points_per_game DECIMAL(6,2) NULL,
  MODIFY rebounds_per_game DECIMAL(6,2) NULL,
  MODIFY assists_per_game DECIMAL(6,2) NULL,
  MODIFY efficiency DECIMAL(6,2) NULL,
  ADD COLUMN first_name VARCHAR(80) NULL AFTER team_id,
  ADD COLUMN last_name VARCHAR(80) NULL AFTER first_name,
  ADD COLUMN height VARCHAR(20) NULL AFTER age,
  ADD COLUMN weight VARCHAR(20) NULL AFTER height,
  ADD COLUMN jersey_number VARCHAR(10) NULL AFTER weight,
  ADD COLUMN college VARCHAR(120) NULL AFTER jersey_number,
  ADD COLUMN country VARCHAR(120) NULL AFTER college,
  ADD COLUMN draft_year INT NULL AFTER country,
  ADD COLUMN draft_round INT NULL AFTER draft_year,
  ADD COLUMN draft_number INT NULL AFTER draft_round,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER draft_number;

ALTER TABLE games
  MODIFY game_date DATE NULL,
  MODIFY home_score INT NULL,
  MODIFY away_score INT NULL,
  MODIFY status VARCHAR(30) NOT NULL,
  MODIFY arena VARCHAR(120) NULL,
  ADD COLUMN season INT NULL AFTER id,
  ADD COLUMN period INT NULL AFTER status,
  ADD COLUMN clock VARCHAR(32) NULL AFTER period,
  ADD COLUMN postseason TINYINT(1) NOT NULL DEFAULT 0 AFTER clock,
  ADD COLUMN postponed TINYINT(1) NOT NULL DEFAULT 0 AFTER postseason,
  ADD COLUMN datetime_utc DATETIME NULL AFTER postponed;

ALTER TABLE team_stats
  MODIFY win_pct DECIMAL(6,3) NOT NULL,
  MODIFY points_per_game DECIMAL(6,2) NOT NULL,
  MODIFY points_allowed_per_game DECIMAL(6,2) NOT NULL,
  MODIFY rebounds_per_game DECIMAL(6,2) NULL,
  MODIFY assists_per_game DECIMAL(6,2) NULL,
  MODIFY recent_form DECIMAL(5,3) NOT NULL,
  ADD COLUMN season INT NULL AFTER team_id,
  ADD COLUMN games_played INT NOT NULL DEFAULT 0 AFTER losses,
  ADD COLUMN last_synced_at DATETIME NULL AFTER recent_form;

CREATE TABLE IF NOT EXISTS player_game_stats (
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  team_id INT NOT NULL,
  minutes VARCHAR(20) NULL,
  points INT NULL,
  rebounds INT NULL,
  assists INT NULL,
  steals INT NULL,
  blocks INT NULL,
  turnovers INT NULL,
  field_goals_made INT NULL,
  field_goals_attempted INT NULL,
  free_throws_made INT NULL,
  free_throws_attempted INT NULL,
  three_points_made INT NULL,
  three_points_attempted INT NULL,
  offensive_rebounds INT NULL,
  defensive_rebounds INT NULL,
  personal_fouls INT NULL,
  plus_minus VARCHAR(20) NULL,
  PRIMARY KEY (game_id, player_id),
  CONSTRAINT fk_player_game_stats_game
    FOREIGN KEY (game_id) REFERENCES games(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_player_game_stats_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_player_game_stats_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE
);
