"""
Regression test: server.py must not contain duplicate @api_router paths.

Bug history (Feb 2026): the `_create_notification` HELPER function was
accidentally decorated with `@api_router.get("/users/search")`, shadowing the
real `search_users` route and returning HTTP 422 in production because the
helper's positional args (user_id, notif_type, title, message) were being
validated as required query params.
"""
import re
from collections import Counter
from pathlib import Path


SERVER_PY = Path(__file__).resolve().parent.parent / "server.py"


def test_no_duplicate_api_router_paths():
    src = SERVER_PY.read_text()
    routes = re.findall(r'@api_router\.(get|post|put|delete|patch)\("([^"]+)"\)', src)
    counts = Counter(routes)
    duplicates = {route: n for route, n in counts.items() if n > 1}
    assert not duplicates, f"Duplicate @api_router routes found: {duplicates}"


def test_helper_functions_not_decorated_as_routes():
    """Any function whose name starts with an underscore must NOT be preceded
    by an @api_router decorator."""
    src = SERVER_PY.read_text().splitlines()
    offenders = []
    for i, line in enumerate(src):
        m = re.match(r'\s*async def (_\w+)\(', line)
        if m and i > 0 and "@api_router." in src[i - 1]:
            offenders.append((i + 1, m.group(1), src[i - 1].strip()))
    assert not offenders, f"Helper functions decorated as routes: {offenders}"
