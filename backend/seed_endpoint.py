"""One-off: create a sample endpoint and run checks so the dashboard has data."""
import os
import sys
from pathlib import Path

# Load .env and setup Django
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "api.settings.development")
import django
django.setup()

from apps.core.models import Endpoint, CheckResult
import requests
import time

# Create endpoint if none exist
if not Endpoint.objects.exists():
    Endpoint.objects.create(
        name="Example API",
        url="https://httpbin.org/get",
        interval_minutes=5,
    )
    print("Created endpoint: Example API -> https://httpbin.org/get")

# Run one check for each endpoint
for ep in Endpoint.objects.all():
    start = time.perf_counter()
    try:
        r = requests.get(ep.url, timeout=10)
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        success = 200 <= r.status_code < 300
        CheckResult.objects.create(
            endpoint=ep,
            status_code=r.status_code,
            response_time_ms=elapsed_ms,
            success=success,
            error_message="" if success else f"HTTP {r.status_code}",
        )
        print(f"Check recorded for {ep.name}: {'Up' if success else 'Down'} ({r.status_code}, {elapsed_ms}ms)")
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        CheckResult.objects.create(
            endpoint=ep,
            status_code=None,
            response_time_ms=elapsed_ms,
            success=False,
            error_message=str(e),
        )
        print(f"Check recorded for {ep.name}: Down - {e}")
print("Done. Open http://localhost:3000 to see the dashboard.")
