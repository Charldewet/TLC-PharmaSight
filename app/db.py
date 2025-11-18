import os
from typing import Optional
from sqlalchemy import create_engine

DEFAULT_DATABASE_URL = (
    "postgresql://pharmacy_user:PzL1HpYNaYOrmcfImjeZm8LitHTd4d7F@dpg-d28vb1muk2gs73frrns0-a.oregon-postgres.render.com/pharmacy_reports"
)


def ensure_sslmode_in_url(database_url: str) -> str:
    if "sslmode=" in database_url:
        return database_url
    separator = "&" if "?" in database_url else "?"
    return f"{database_url}{separator}sslmode=require"


def get_database_url() -> str:
    env_url: Optional[str] = os.environ.get("DATABASE_URL")
    url = env_url.strip() if env_url else DEFAULT_DATABASE_URL
    return ensure_sslmode_in_url(url)


engine = create_engine(get_database_url(), pool_pre_ping=True) 