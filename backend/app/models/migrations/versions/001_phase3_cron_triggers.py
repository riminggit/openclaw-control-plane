"""
Phase 3 Database Migration — Cron & Trigger tables.

Creates four new tables:
  - cron_jobs        : scheduled job definitions (cron / at / every)
  - cron_executions  : per-execution records with timing & results
  - trigger_configs  : webhook / API callback trigger definitions
  - trigger_events   : trigger invocation records

Usage:
  # Standalone (for existing databases):
  python -m app.models.migrations.versions.001_phase3_cron_triggers

  # Or via init_db() — tables are auto-created on startup.
"""

import sys
import logging

logger = logging.getLogger(__name__)


def upgrade() -> None:
    """Create Phase 3 tables using Base.metadata.create_all()."""
    from sqlalchemy import inspect

    from app.db import engine, Base
    from app.models.cron import CronJob, CronExecution, TriggerConfig, TriggerEvent  # noqa: F401

    inspector = inspect(engine)
    tables_to_create = [
        CronJob.__table__,
        CronExecution.__table__,
        TriggerConfig.__table__,
        TriggerEvent.__table__,
    ]

    new_tables = [t for t in tables_to_create if not inspector.has_table(t.name)]
    if not new_tables:
        logger.info("Phase 3 migration: all tables already exist, nothing to do.")
        return

    table_names = [t.name for t in new_tables]
    logger.info("Phase 3 migration: creating tables %s", table_names)
    Base.metadata.create_all(bind=engine, tables=new_tables)
    logger.info("Phase 3 migration: created %d table(s).", len(new_tables))


def downgrade() -> None:
    """Drop Phase 3 tables (for rollback)."""
    from app.db import engine, Base
    from app.models.cron import CronJob, CronExecution, TriggerConfig, TriggerEvent  # noqa: F401

    tables = [
        TriggerEvent.__table__,    # depends on trigger_configs
        CronExecution.__table__,   # depends on cron_jobs
        TriggerConfig.__table__,
        CronJob.__table__,
    ]
    logger.info("Phase 3 downgrade: dropping tables %s", [t.name for t in tables])
    Base.metadata.drop_all(bind=engine, tables=tables)
    logger.info("Phase 3 downgrade: tables dropped.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    try:
        upgrade()
        print("✅ Phase 3 migration completed successfully.")
    except Exception as exc:
        print(f"❌ Phase 3 migration failed: {exc}", file=sys.stderr)
        raise
