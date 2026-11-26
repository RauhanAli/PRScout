"""DATABASE_URL as hosted Postgres providers (Neon, Railway) hand it out."""

from prscout_server.db import asyncpg_url


def test_a_neon_url_works_as_pasted():
    got = asyncpg_url("postgresql://u:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb"
                      "?sslmode=require&channel_binding=require")
    assert got == "postgresql+asyncpg://u:p%40ss@ep-x.eu-central-1.aws.neon.tech/neondb?ssl=require"


def test_the_driver_is_added_and_nothing_else_changes():
    assert asyncpg_url("postgres://u:p@h:5432/d") == "postgresql+asyncpg://u:p@h:5432/d"
    assert asyncpg_url("postgresql+asyncpg://u:p@h/d?ssl=require") == "postgresql+asyncpg://u:p@h/d?ssl=require"
    assert asyncpg_url("sqlite+aiosqlite:///:memory:") == "sqlite+aiosqlite:///:memory:"
