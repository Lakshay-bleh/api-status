from rest_framework import serializers
from .models import Endpoint, CheckResult


class CheckResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = CheckResult
        fields = (
            "id",
            "status_code",
            "response_time_ms",
            "success",
            "checked_at",
            "error_message",
        )
        read_only_fields = fields


class EndpointSerializer(serializers.ModelSerializer):
    latest_check = serializers.SerializerMethodField()

    class Meta:
        model = Endpoint
        fields = (
            "id",
            "name",
            "url",
            "interval_minutes",
            "created_at",
            "updated_at",
            "latest_check",
        )
        read_only_fields = ("created_at", "updated_at", "latest_check")

    def get_latest_check(self, obj):
        latest = obj.checks.first()
        if latest is None:
            return None
        return CheckResultSerializer(latest).data


class EndpointListSerializer(serializers.ModelSerializer):
    latest_check = serializers.SerializerMethodField()

    class Meta:
        model = Endpoint
        fields = (
            "id",
            "name",
            "url",
            "interval_minutes",
            "created_at",
            "updated_at",
            "latest_check",
        )

    def get_latest_check(self, obj):
        latest = obj.checks.first()
        if latest is None:
            return None
        return CheckResultSerializer(latest).data
