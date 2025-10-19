import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    """Minimal Python backend for Vercel handling GET and POST requests."""

    def _send_json(self, payload: dict, status_code: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        """Respond with a simple health payload to confirm deployment."""
        self._send_json(
            {
                "status": "ok",
                "message": "Python backend is running on Vercel.",
                "docs": "https://vercel.com/docs/functions/runtimes/python",
            }
        )

    def do_POST(self) -> None:
        """Echo back a field from the JSON payload for quick testing."""
        content_length = int(self.headers.get("content-length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b""

        if not raw_body:
            self._send_json({"error": "Empty request body"}, status_code=400)
            return

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON payload"}, status_code=400)
            return

        expression = payload.get("expression", "")
        self._send_json(
            {
                "received": expression,
                "length": len(expression),
            }
        )
