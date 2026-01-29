import time
import os
import requests
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Avg, OuterRef, Subquery
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Endpoint, CheckResult
from .serializers import (
    EndpointSerializer,
    EndpointListSerializer,
    CheckResultSerializer,
)


def health(request):
    return JsonResponse({"status": "ok"})


def _validate_cron_secret(request):
    secret = os.environ.get("CRON_SECRET", "")
    if not secret:
        return False
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:] == secret
    return request.GET.get("secret") == secret


def _endpoint_is_due(endpoint):
    """True if endpoint has no last check or last check was >= interval_minutes ago."""
    latest = endpoint.checks.first()
    if latest is None:
        return True
    delta = timezone.now() - latest.checked_at
    return delta.total_seconds() >= endpoint.interval_minutes * 60


@csrf_exempt
@require_http_methods(["GET", "POST"])
def run_checks(request):
    """
    Run health checks for all endpoints that are "due" based on their interval_minutes.
    Called by Vercel Cron every minute; only endpoints whose last check was at least
    interval_minutes ago (or never checked) are pinged.
    """
    if not _validate_cron_secret(request):
        return JsonResponse({"error": "Unauthorized"}, status=401)
    checked = 0
    failed = 0
    skipped = 0
    timeout_seconds = 10
    for endpoint in Endpoint.objects.all():
        if not _endpoint_is_due(endpoint):
            skipped += 1
            continue
        start = time.perf_counter()
        try:
            r = requests.get(endpoint.url, timeout=timeout_seconds)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            success = 200 <= r.status_code < 300
            CheckResult.objects.create(
                endpoint=endpoint,
                status_code=r.status_code,
                response_time_ms=elapsed_ms,
                success=success,
                error_message="" if success else f"HTTP {r.status_code}",
            )
            checked += 1
            if not success:
                failed += 1
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            CheckResult.objects.create(
                endpoint=endpoint,
                status_code=None,
                response_time_ms=elapsed_ms,
                success=False,
                error_message=str(e),
            )
            checked += 1
            failed += 1
    return JsonResponse({"checked": checked, "failed": failed, "skipped": skipped})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    endpoints = Endpoint.objects.filter(user=request.user)
    endpoint_id = request.query_params.get("endpoint_id")
    if endpoint_id:
        endpoints = endpoints.filter(pk=endpoint_id)
    total_endpoints = endpoints.count()
    now = timezone.now()
    since_24h = now - timezone.timedelta(hours=24)
    up_count = 0
    down_count = 0
    for ep in endpoints:
        latest = ep.checks.first()
        if latest:
            if latest.success:
                up_count += 1
            else:
                down_count += 1
    checks_24h = CheckResult.objects.filter(
        endpoint__user=request.user,
        endpoint__in=endpoints,
        checked_at__gte=since_24h,
    )
    total_checks_24h = checks_24h.count()
    success_checks_24h = checks_24h.filter(success=True).count()
    uptime_pct_24h = (
        round(100.0 * success_checks_24h / total_checks_24h, 1)
        if total_checks_24h else None
    )
    recent_checks = (
        CheckResult.objects.filter(endpoint__user=request.user)
        .select_related("endpoint")
        .order_by("-checked_at")[:10]
    )
    recent_checks_data = [
        {
            "id": c.id,
            "endpoint_id": c.endpoint_id,
            "endpoint_name": c.endpoint.name,
            "success": c.success,
            "status_code": c.status_code,
            "response_time_ms": c.response_time_ms,
            "checked_at": c.checked_at.isoformat(),
            "error_message": c.error_message,
        }
        for c in recent_checks
    ]
    return Response({
        "total_endpoints": total_endpoints,
        "up_count": up_count,
        "down_count": down_count,
        "uptime_pct_24h": uptime_pct_24h,
        "recent_checks": recent_checks_data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics(request):
    endpoints = Endpoint.objects.filter(user=request.user)
    endpoint_id = request.query_params.get("endpoint_id")
    if endpoint_id:
        endpoints = endpoints.filter(pk=endpoint_id)
    since = request.query_params.get("since")
    until = request.query_params.get("until")
    group_by = request.query_params.get("group_by", "day")
    if not since:
        since_dt = timezone.now() - timezone.timedelta(days=7)
    else:
        try:
            from datetime import datetime
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            if timezone.is_naive(since_dt):
                since_dt = timezone.make_aware(since_dt)
        except (ValueError, TypeError):
            since_dt = timezone.now() - timezone.timedelta(days=7)
    if until:
        try:
            from datetime import datetime
            until_dt = datetime.fromisoformat(until.replace("Z", "+00:00"))
            if timezone.is_naive(until_dt):
                until_dt = timezone.make_aware(until_dt)
        except (ValueError, TypeError):
            until_dt = timezone.now()
    else:
        until_dt = timezone.now()
    qs = CheckResult.objects.filter(
        endpoint__in=endpoints,
        checked_at__gte=since_dt,
        checked_at__lte=until_dt,
    )
    if group_by == "hour":
        from django.db.models.functions import TruncHour
        qs = qs.annotate(period=TruncHour("checked_at"))
    else:
        from django.db.models.functions import TruncDate
        qs = qs.annotate(period=TruncDate("checked_at"))
    from django.db.models import Count, Avg, Q
    series = []
    for row in qs.values("period").annotate(
        total_checks=Count("id"),
        failure_count=Count("id", filter=Q(success=False)),
        success_count=Count("id", filter=Q(success=True)),
        avg_response_time_ms=Avg("response_time_ms"),
    ).order_by("period"):
        total = row["total_checks"]
        success = row["success_count"]
        series.append({
            "period": row["period"].isoformat() if hasattr(row["period"], "isoformat") else str(row["period"]),
            "total_checks": total,
            "failure_count": row["failure_count"],
            "uptime_pct": round(100.0 * success / total, 1) if total else 0,
            "avg_response_time_ms": round(row["avg_response_time_ms"] or 0, 1),
        })
    all_checks = CheckResult.objects.filter(
        endpoint__in=endpoints,
        checked_at__gte=since_dt,
        checked_at__lte=until_dt,
    )
    total_all = all_checks.count()
    success_all = all_checks.filter(success=True).count()
    summary = {
        "uptime_pct": round(100.0 * success_all / total_all, 1) if total_all else 0,
        "avg_response_time_ms": round(all_checks.aggregate(Avg("response_time_ms"))["response_time_ms__avg"] or 0, 1),
        "total_checks": total_all,
    }
    return Response({"series": series, "summary": summary})


class EndpointViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Endpoint.objects.all()

    def get_queryset(self):
        qs = Endpoint.objects.filter(user=self.request.user)
        status_filter = self.request.query_params.get("status")
        if status_filter in ("up", "down"):
            from django.db.models import OuterRef, Subquery
            from .models import CheckResult
            latest_success = (
                CheckResult.objects.filter(endpoint=OuterRef("pk"))
                .order_by("-checked_at")
                .values("success")[:1]
            )
            qs = qs.annotate(_latest_success=Subquery(latest_success))
            if status_filter == "up":
                qs = qs.filter(_latest_success=True)
            else:
                qs = qs.filter(_latest_success=False)
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "list":
            return EndpointListSerializer
        return EndpointSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"], url_path="checks")
    def checks_list(self, request, pk=None):
        endpoint = self.get_object()
        limit = min(int(request.GET.get("limit", 100)), 500)
        since = request.GET.get("since")
        qs = endpoint.checks.all()
        if since:
            from django.utils import timezone
            from datetime import datetime
            try:
                since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
                if timezone.is_naive(since_dt):
                    since_dt = timezone.make_aware(since_dt)
                qs = qs.filter(checked_at__gte=since_dt)
            except (ValueError, TypeError):
                pass
        qs = qs[:limit]
        serializer = CheckResultSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="check-now")
    def check_now(self, request, pk=None):
        endpoint = self.get_object()
        if endpoint.user_id != request.user.id:
            return Response({"detail": "Not found"}, status=404)
        timeout_seconds = 10
        start = time.perf_counter()
        try:
            r = requests.get(endpoint.url, timeout=timeout_seconds)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            success = 200 <= r.status_code < 300
            check = CheckResult.objects.create(
                endpoint=endpoint,
                status_code=r.status_code,
                response_time_ms=elapsed_ms,
                success=success,
                error_message="" if success else f"HTTP {r.status_code}",
            )
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            check = CheckResult.objects.create(
                endpoint=endpoint,
                status_code=None,
                response_time_ms=elapsed_ms,
                success=False,
                error_message=str(e),
            )
        serializer = CheckResultSerializer(check)
        return Response(serializer.data, status=201)
