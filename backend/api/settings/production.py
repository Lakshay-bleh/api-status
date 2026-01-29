import os
from .base import *  # noqa: F401, F403

DEBUG = False

CONN_MAX_AGE = 0
CONN_HEALTH_CHECKS = True

if os.environ.get("DATABASE_URL"):
    import dj_database_url
    DATABASES = {
        "default": dj_database_url.config(conn_max_age=0)
    }
    if not DATABASES["default"]:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }
else:
    PGHOST = os.environ.get("PGHOST")
    if PGHOST:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": os.environ.get("PGDATABASE", "neondb"),
                "USER": os.environ.get("PGUSER"),
                "PASSWORD": os.environ.get("PGPASSWORD"),
                "HOST": PGHOST,
                "PORT": os.environ.get("PGPORT", "5432"),
                "OPTIONS": {"sslmode": "require"},
                "CONN_MAX_AGE": 0,
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }
