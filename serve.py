import json
from http.client import HTTPConnection, HTTPException
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


SITE_DIRECTORY = Path(__file__).resolve().parent / "dist"
N8N_PORT = 5678
MAX_BYTES = 64 * 1024


class PulseHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIRECTORY), **kwargs)

    def do_POST(self):
        if self.path != "/api/boletim":
            self.send_error(404)
            return

        port = self.server.server_port
        host = self.headers.get("Host")
        origin = self.headers.get("Origin")
        if host not in {f"localhost:{port}", f"127.0.0.1:{port}"} or origin not in (None, f"http://{host}"):
            self.send_error(403)
            return
        if self.headers.get_content_type() != "application/json":
            self.send_error(415)
            return

        try:
            size = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_error(400)
            return
        if not 0 < size <= MAX_BYTES:
            self.send_error(413)
            return

        body = self.rfile.read(size)
        n8n = HTTPConnection("127.0.0.1", N8N_PORT, timeout=35)
        try:
            n8n.request("POST", "/webhook/pulse-boletim", body, {"Content-Type": "application/json"})
            upstream = n8n.getresponse()
            if upstream.status == 429:
                self.send_json(429, {"error": "Cota atingida."})
                return
            if upstream.status != 200:
                self.send_json(502, {"error": "O workflow do n8n retornou um erro."})
                return

            response = upstream.read(MAX_BYTES + 1)
            if len(response) > MAX_BYTES:
                raise ValueError("Resposta acima do limite.")
            result = json.loads(response)
            text = result.get("text") if isinstance(result, dict) else None
            if not isinstance(text, str) or not text.strip():
                raise ValueError("Resposta sem texto.")
        except (HTTPException, OSError, ValueError):
            self.send_json(502, {"error": "O n8n não devolveu um boletim válido."})
            return
        finally:
            n8n.close()

        self.send_json(200, {"text": text})

    def send_json(self, status, payload):
        response = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(response)


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 8000), PulseHandler) as server:
        print("Pulse Analytics em http://localhost:8000", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
