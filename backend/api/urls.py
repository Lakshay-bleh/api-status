from django.urls import path, include

urlpatterns = [
    path("", include("apps.core.urls")),
    path("api/v1/", include("apps.core.urls")),
]
