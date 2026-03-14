CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX idx_tasks_user_date_category ON tasks(user_id, date, category);
CREATE INDEX idx_plan_items_user_date ON plan_items(user_id, date);
CREATE INDEX idx_users_email ON users(email);
