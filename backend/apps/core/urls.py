from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import auth_views

router = DefaultRouter()
router.register(r"endpoints", views.EndpointViewSet, basename="endpoint")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", views.health),
    path("cron/run-checks", views.run_checks),
    path("auth/register/", auth_views.register),
    path("auth/login/", auth_views.login),
    path("auth/me/", auth_views.me),
    path("dashboard/stats/", views.dashboard_stats),
    path("analytics/", views.analytics),
]
