from __future__ import annotations

import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from python_backend import (
    ensure_database,
    get_coauthor_network,
    get_overview_stats,
    get_q1_influence_network,
    get_db_path,
    list_authors,
    list_authors_by_h_index,
)

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


@app.get("/api/summary")
def summary():
    return jsonify(get_overview_stats())


@app.get("/api/authors")
def authors():
    return jsonify(list_authors())


@app.get("/api/query/coauthors")
def coauthors():
    result = get_coauthor_network(request.args.get("authorId"))

    if result is None:
        return jsonify({"message": "Author not found."}), 404

    return jsonify(result)


@app.get("/api/query/h-index")
def h_index():
    minimum = int(request.args.get("minimum", 5))
    return jsonify(list_authors_by_h_index(minimum))


@app.get("/api/query/q1-influence")
def q1_influence():
    return jsonify(get_q1_influence_network())


@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path: str):
    target = PUBLIC_DIR / path

    if path.startswith("api/"):
      return jsonify({"message": "API route not found."}), 404

    if target.exists() and target.is_file():
        return send_from_directory(PUBLIC_DIR, path)

    return send_from_directory(PUBLIC_DIR, "index.html")


if __name__ == "__main__":
    if "--init-db" in sys.argv:
        ensure_database(force=True)
        print(f"Database ready at {get_db_path()}")
        raise SystemExit(0)

    ensure_database()
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 3000
    print(f"Academic Library Management System running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
