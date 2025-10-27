-- Cleanup legacy PascalCase tables (leftovers from earlier iteration)
DROP TABLE IF EXISTS "public"."ReportAudit" CASCADE;
DROP TABLE IF EXISTS "public"."ReportFile" CASCADE;
DROP TABLE IF EXISTS "public"."ReportSchedule" CASCADE;
DROP TABLE IF EXISTS "public"."ReportTemplate" CASCADE;

-- Ensure snake_case report tables exist with the expected structure
CREATE TABLE IF NOT EXISTS "public"."report_template" (
        "id"              SERIAL PRIMARY KEY,
        "name"            TEXT NOT NULL,
        "description"     TEXT,
        "key"             TEXT NOT NULL UNIQUE,
        "default_params"  JSONB,
        "created_at"      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "created_by_id"   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."report_schedule" (
        "id"              SERIAL PRIMARY KEY,
        "template_id"     INTEGER NOT NULL,
        "name"            TEXT NOT NULL,
        "cron"            TEXT NOT NULL,
        "recipients"      TEXT NOT NULL,
        "last_run_at"     TIMESTAMP WITH TIME ZONE,
        "next_run_at"     TIMESTAMP WITH TIME ZONE,
        "active"          BOOLEAN DEFAULT true NOT NULL,
        "params"          JSONB,
        "created_at"      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        "created_by_id"   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."report_audit" (
        "id"            SERIAL PRIMARY KEY,
        "usuario_id"    INTEGER NOT NULL,
        "action"        TEXT NOT NULL,
        "template_key"  TEXT,
        "params"        JSONB,
        "ip"            TEXT,
        "user_agent"    TEXT,
        "created_at"    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."report_file" (
    "id"            SERIAL PRIMARY KEY,
    "template_key"  TEXT,
    "path"          TEXT NOT NULL,
    "filename"      TEXT NOT NULL,
    "mime"          TEXT NOT NULL,
    "size"          INTEGER NOT NULL,
    "created_by"    INTEGER,
    "created_at"    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Recreate indexes/constraints idempotently
CREATE UNIQUE INDEX IF NOT EXISTS "report_template_key_key"
        ON "public"."report_template" ("key");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_report_template_usuario'
    ) THEN
        ALTER TABLE "public"."report_template"
            ADD CONSTRAINT "fk_report_template_usuario"
            FOREIGN KEY ("created_by_id") REFERENCES "public"."usuario"("id_usuario")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_schedule_template'
    ) THEN
        ALTER TABLE "public"."report_schedule"
            ADD CONSTRAINT "fk_report_schedule_template"
            FOREIGN KEY ("template_id") REFERENCES "public"."report_template"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_schedule_usuario'
    ) THEN
        ALTER TABLE "public"."report_schedule"
            ADD CONSTRAINT "fk_report_schedule_usuario"
            FOREIGN KEY ("created_by_id") REFERENCES "public"."usuario"("id_usuario")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_audit_usuario'
    ) THEN
        ALTER TABLE "public"."report_audit"
            ADD CONSTRAINT "fk_report_audit_usuario"
            FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id_usuario")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_file_usuario'
        ) THEN
            ALTER TABLE "public"."report_file"
                ADD CONSTRAINT "fk_report_file_usuario"
                FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id_usuario")
                ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
