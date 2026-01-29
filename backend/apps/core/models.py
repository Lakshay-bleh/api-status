from django.conf import settings
from django.db import models


class Endpoint(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="endpoints",
    )
    name = models.CharField(max_length=255)
    url = models.URLField()
    interval_minutes = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class CheckResult(models.Model):
    endpoint = models.ForeignKey(Endpoint, on_delete=models.CASCADE, related_name="checks")
    status_code = models.PositiveIntegerField(null=True, blank=True)
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)
    success = models.BooleanField()
    checked_at = models.DateTimeField(auto_now_add=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["endpoint", "checked_at"]),
        ]

    def __str__(self):
        return f"{self.endpoint.name} @ {self.checked_at}"
