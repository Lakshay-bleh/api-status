"""
Vercel serverless entry for Django. All /api/v1/* requests are routed here.
Extends BaseHTTPRequestHandler so Vercel populates path, command, headers, rfile; builds WSGI environ, strips /api/v1, delegates to Django.
"""
import io
from http.server import BaseHTTPRequestHandler
import os
import sys

# Add project root and backend to path
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "api.settings.production")

import django
django.setup()

from django.core.handlers.wsgi import WSGIHandler

_django_app = WSGIHandler()
PREFIX = "/api/v1"


def _get_environ(handler):
    """Build WSGI environ from BaseHTTPRequestHandler."""
    path = handler.path
    if "?" in path:
        path, query = path.split("?", 1)
    else:
        query = ""
    if path.startswith(PREFIX):
        path = path[len(PREFIX):] or "/"
    content_length = handler.headers.get("Content-Length", 0)
    try:
        body_length = int(content_length)
    except ValueError:
        body_length = 0
    body = handler.rfile.read(body_length) if body_length else b""
    environ = {
        "REQUEST_METHOD": handler.command,
        "PATH_INFO": path,
        "SCRIPT_NAME": PREFIX,
        "QUERY_STRING": query,
        "CONTENT_TYPE": handler.headers.get("Content-Type", ""),
        "CONTENT_LENGTH": str(body_length),
        "SERVER_NAME": "localhost",
        "SERVER_PORT": "80",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.input": io.BytesIO(body),
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "https",
        "wsgi.multithread": False,
        "wsgi.multiprocess": False,
        "wsgi.run_once": True,
    }
    for key in ("HTTP_HOST", "HTTP_USER_AGENT", "HTTP_ACCEPT", "HTTP_AUTHORIZATION"):
        if key in handler.headers:
            h = key.replace("HTTP_", "").replace("_", "-").title()
            if key in handler.headers:
                environ[key] = handler.headers[h] if h in handler.headers else handler.headers.get(key)
    for k, v in handler.headers.items():
        if k.lower() != "content-length" and k.lower() != "content-type":
            environ["HTTP_" + k.upper().replace("-", "_")] = v
    return environ


def _start_response(status, response_headers, exc_info=None):
    """Capture status and headers for the response."""
    result = [status, response_headers]
    return result


class handler(BaseHTTPRequestHandler):
    """Vercel Python handler: delegate to Django WSGI app. Must extend BaseHTTPRequestHandler so request method/path/body are set."""
    log_message = lambda *args: None  # no-op; avoid default stderr logging in serverless

    def do_GET(self):
        self._dispatch()

    def do_POST(self):
        self._dispatch()

    def do_PATCH(self):
        self._dispatch()

    def do_PUT(self):
        self._dispatch()

    def do_DELETE(self):
        self._dispatch()

    def do_HEAD(self):
        self._dispatch()

    def do_OPTIONS(self):
        self._dispatch()

    def _dispatch(self):
        environ = _get_environ(self)
        body_parts = []
        start_response_called = []

        def start_response(status, response_headers, exc_info=None):
            start_response_called.append(True)
            code, _ = status.split(" ", 1)
            self.send_response(int(code))
            for k, v in response_headers:
                if k.lower() != "content-length":
                    self.send_header(k, v)
            self.end_headers()
            return body_parts.append

        response_iter = _django_app(environ, start_response)
        if not start_response_called:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Internal Server Error")
            return
        for chunk in response_iter:
            if chunk:
                body_parts.append(chunk)
        for chunk in body_parts:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            self.wfile.write(chunk)
