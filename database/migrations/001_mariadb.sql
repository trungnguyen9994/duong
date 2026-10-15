CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 email_confirmed_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS profiles (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254), display_name VARCHAR(100) NOT NULL DEFAULT '',
 role ENUM('teacher','admin','super_admin') NOT NULL DEFAULT 'teacher',
 status ENUM('active','pending','suspended') NOT NULL DEFAULT 'active', permissions JSON NOT NULL DEFAULT ('[]'),
 storage_limit BIGINT NOT NULL DEFAULT 209715200, upload_limit INT NOT NULL DEFAULT 2,
 daily_export_limit INT NOT NULL DEFAULT 20, concurrent_export_limit INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX(user_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auth_tokens (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, purpose ENUM('verify','reset') NOT NULL,
 expires_at DATETIME(3) NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS app_settings (`key` VARCHAR(80) PRIMARY KEY, value JSON NOT NULL) ENGINE=InnoDB;
INSERT IGNORE INTO app_settings VALUES ('require_account_approval','false'),('queue_lock','false');
CREATE TABLE IF NOT EXISTS subjects (id VARCHAR(40) PRIMARY KEY, name VARCHAR(80) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE) ENGINE=InnoDB;
INSERT IGNORE INTO subjects(id,name) VALUES ('math','Toán'),('vietnamese','Tiếng Việt'),('science','Tự nhiên và Xã hội'),('ethics','Đạo đức'),('technology','Công nghệ'),('other','Khác');
CREATE TABLE IF NOT EXISTS templates (`type` VARCHAR(40) PRIMARY KEY, name VARCHAR(100) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE) ENGINE=InnoDB;
INSERT IGNORE INTO templates(type,name) VALUES ('journey','Hành trình tri thức'),('picture_reveal','Mảnh ghép bí mật'),('word_wheel','Vòng quay ô chữ');
CREATE TABLE IF NOT EXISTS template_versions (
 template_type VARCHAR(40), version INT, released BOOLEAN NOT NULL DEFAULT TRUE, config JSON NOT NULL DEFAULT ('{}'),
 PRIMARY KEY(template_type,version), FOREIGN KEY(template_type) REFERENCES templates(type)
) ENGINE=InnoDB;
INSERT IGNORE INTO template_versions VALUES ('journey',1,TRUE,'{"editor":"journey","pptx":"linked","maxSlides":60}'),('picture_reveal',1,TRUE,'{"editor":"picture_reveal","pptx":"linear","grids":[4,6,9]}'),('word_wheel',1,TRUE,'{"editor":"word_wheel","pptx":"scripted","manualScoring":true}');
CREATE TABLE IF NOT EXISTS assets (
 id CHAR(36) PRIMARY KEY, owner_id CHAR(36), name VARCHAR(180) NOT NULL, path VARCHAR(255) UNIQUE,
 thumbnail_path VARCHAR(255), mime VARCHAR(150), bytes BIGINT NOT NULL DEFAULT 0, width INT, height INT,
 status ENUM('pending','processing','ready','failed','deleted') NOT NULL DEFAULT 'pending', source TEXT, license TEXT,
 approved BOOLEAN NOT NULL DEFAULT FALSE, alt_text VARCHAR(300) NOT NULL DEFAULT '', revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(owner_id) REFERENCES profiles(id), INDEX(owner_id,status)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS games (
 id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, spec JSON NOT NULL, revision INT NOT NULL DEFAULT 1,
 status ENUM('draft','pending','published','archived') NOT NULL DEFAULT 'draft',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(owner_id) REFERENCES profiles(id), INDEX(owner_id,updated_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS asset_references (
 game_id CHAR(36), asset_id CHAR(36), PRIMARY KEY(game_id,asset_id),
 FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE, FOREIGN KEY(asset_id) REFERENCES assets(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS questions (
 id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, body JSON NOT NULL, revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(owner_id) REFERENCES profiles(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS play_sessions (
 id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, game_id CHAR(36), result JSON NOT NULL DEFAULT ('{}'),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(owner_id) REFERENCES profiles(id), FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS jobs (
 id CHAR(36) PRIMARY KEY, owner_id CHAR(36) NOT NULL, kind ENUM('upload','export') NOT NULL, idempotency_key VARCHAR(80) NOT NULL,
 payload JSON NOT NULL, status ENUM('queued','running','completed','failed') NOT NULL DEFAULT 'queued', attempts INT NOT NULL DEFAULT 0,
 lease_token CHAR(36), lease_until DATETIME(3), result JSON, error TEXT,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE(owner_id,kind,idempotency_key), FOREIGN KEY(owner_id) REFERENCES profiles(id), INDEX(status,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS share_links (
 id CHAR(36) PRIMARY KEY, game_id CHAR(36) NOT NULL, owner_id CHAR(36) NOT NULL, snapshot JSON NOT NULL,
 revoked_at DATETIME(3), created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES profiles(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, actor_id CHAR(36), action VARCHAR(100) NOT NULL, target_id VARCHAR(100), details JSON NOT NULL DEFAULT ('{}'),
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(actor_id) REFERENCES profiles(id)
) ENGINE=InnoDB;
