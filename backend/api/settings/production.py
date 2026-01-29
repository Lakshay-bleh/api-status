import os
from .base import *  # noqa: F401, F403

DEBUG = False

# Django is mounted at /api/v1 on Vercel. Without this, redirects (e.g. append_slash) would
# point to /auth/register/ instead of /api/v1/auth/register/, causing redirect loops.
FORCE_SCRIPT_NAME = "/api/v1"

# Disable append_slash redirect (301) so we never redirect no-slash → slash. Vercel/Next
# can 308 slash → no-slash; without this we'd 301 back and create an infinite loop.
APPEND_SLASH = False

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
