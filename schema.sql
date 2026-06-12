-- schema.sql
CREATE TABLE IF NOT EXISTS discord_users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    global_name TEXT,
    avatar TEXT,
    locale TEXT,
    email TEXT,
    bpm INTEGER DEFAULT 90,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- trigger to auto-update `updated_at` on row changes
CREATE TRIGGER IF NOT EXISTS update_discord_users_timestamp 
AFTER UPDATE ON discord_users
BEGIN
    UPDATE discord_users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;