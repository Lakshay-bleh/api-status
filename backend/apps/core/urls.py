from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import auth_views

router = DefaultRouter()
router.register(r"endpoints", views.EndpointViewSet, basename="endpoint")

# Include both with and without trailing slash to avoid redirect loop:
# Vercel/Next can 308 from /api/v1/auth/register/ → /api/v1/auth/register; Django would 301 back
# if we only had the slash version. Accept both so no redirect is issued.
urlpatterns = [
    path("", include(router.urls)),
    path("health/", views.health),
    path("health", views.health),
    path("cron/run-checks", views.run_checks),
    path("auth/register/", auth_views.register),
    path("auth/register", auth_views.register),
    path("auth/login/", auth_views.login),
    path("auth/login", auth_views.login),
    path("auth/me/", auth_views.me),
    path("auth/me", auth_views.me),
    path("dashboard/stats/", views.dashboard_stats),
    path("dashboard/stats", views.dashboard_stats),
    path("analytics/", views.analytics),
    path("analytics", views.analytics),
]
