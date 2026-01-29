import os

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    try:
        # request.data can fail if body is not valid JSON
        username = request.data.get("username") if request.data else None
        password = request.data.get("password") if request.data else None
        email = (request.data.get("email", "") or "") if request.data else ""
    except Exception as e:
        return Response(
            {"detail": "Invalid request body", "error": str(e) if settings.DEBUG else None},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not username or not password:
        return Response(
            {"detail": "username and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.filter(username=username).exists():
        return Response(
            {"detail": "Username already taken"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        user = User.objects.create_user(username=username, password=password, email=email)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": {"id": user.id, "username": user.username, "email": user.email or ""},
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        # Expose error when DEBUG or SHOW_500_ERROR (e.g. on Vercel for one-off debugging)
        show_error = settings.DEBUG or os.environ.get("SHOW_500_ERROR", "").lower() in ("true", "1", "yes")
        return Response(
            {"detail": "Registration failed", "error": str(e) if show_error else None},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    if not username or not password:
        return Response(
            {"detail": "username and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from django.contrib.auth import authenticate
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {"detail": "Invalid credentials"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "user": {"id": user.id, "username": user.username, "email": user.email or ""},
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {"id": user.id, "username": user.username, "email": user.email or ""},
    )
