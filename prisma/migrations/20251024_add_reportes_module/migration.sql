-- Migration: add reportes module tables
-- Generated draft by developer assistant on 2025-10-24

CREATE TABLE IF NOT EXISTS report_template (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key VARCHAR(255) NOT NULL UNIQUE,
  default_params JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_schedule (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  cron VARCHAR(255) NOT NULL,
  recipients TEXT NOT NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  params JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS report_audit (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,
  template_key VARCHAR(255),
  params JSONB,
  ip VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_file (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(255),
  path TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Foreign keys (to usuario table)
ALTER TABLE IF EXISTS report_template
  ADD CONSTRAINT fk_report_template_usuario FOREIGN KEY (created_by_id) REFERENCES "usuario"(id_usuario) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS report_schedule
  ADD CONSTRAINT fk_report_schedule_template FOREIGN KEY (template_id) REFERENCES report_template(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS report_schedule
  ADD CONSTRAINT fk_report_schedule_usuario FOREIGN KEY (created_by_id) REFERENCES "usuario"(id_usuario) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS report_audit
  ADD CONSTRAINT fk_report_audit_usuario FOREIGN KEY (usuario_id) REFERENCES "usuario"(id_usuario) ON DELETE SET NULL;

ALTER TABLE IF EXISTS report_file
  ADD CONSTRAINT fk_report_file_usuario FOREIGN KEY (created_by) REFERENCES "usuario"(id_usuario) ON DELETE SET NULL;
