"""Vercel entry point; all API behavior remains in the local server handler."""
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
server.UPDATE_STATUS.update(state="hosted",message="Game catalogue published from the local extraction pipeline")

class handler(server.Handler):
    def route_api(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query, keep_blank_values=True)
        endpoint = query.pop('endpoint', [])
        if len(endpoint) != 1 or endpoint[0] not in {
            'me','status','auth-config','profile','reports','routes','routes/delete',
            'register','login','logout','google','vote','plan'
        }:
            self.reply({'error':'Not found'},404)
            return False
        self.path = '/api/' + endpoint[0] + ('?' + urlencode(query,doseq=True) if query else '')
        return True
    def do_GET(self):
        if self.route_api(): super().do_GET()
    def do_POST(self):
        if self.route_api(): super().do_POST()
