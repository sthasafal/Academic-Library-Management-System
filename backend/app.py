from __future__ import annotations

import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from python_backend import (
    advanced_search,
    create_author,
    create_institution,
    create_publication,
    create_venue,
    delete_author,
    delete_institution,
    delete_publication,
    delete_venue,
    ensure_database,
    get_authors_by_institution,
    get_coauthor_network,
    get_h_index_report,
    get_influential_authors,
    get_institution_collaboration_ranking,
    get_node_details,
    get_overview_stats,
    get_q1_influence_network,
    get_shortest_collaboration_path,
    get_db_path,
    list_institutions,
    list_collections,
    list_publications,
    list_reference_data,
    list_venues,
    list_graphs,
    list_authors,
    search_suggestions,
    update_author,
    update_institution,
    update_publication,
    update_venue,
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
PUBLIC_DIR = PROJECT_DIR / "frontend"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


def optional_int_arg(name: str) -> int | None:
    value = request.args.get(name)
    if value in (None, ""):
        return None
    return int(value)


@app.errorhandler(ValueError)
def handle_value_error(error: ValueError):
    return jsonify({"message": str(error)}), 400


@app.get("/api/summary")
def summary():
    return jsonify(get_overview_stats())


@app.get("/api/authors")
def authors():
    return jsonify(list_authors())


@app.get("/api/institutions")
def institutions():
    return jsonify(list_institutions())


@app.get("/api/venues")
def venues():
    return jsonify(list_venues())


@app.get("/api/publications")
def publications():
    return jsonify(list_publications())


@app.get("/api/collections")
def collections():
    return jsonify(list_collections())


@app.get("/api/graphs")
def graphs():
    return jsonify(list_graphs())


@app.get("/api/query/coauthors")
def coauthors():
    result = get_coauthor_network(
        request.args.get("authorId"),
        year_from=optional_int_arg("yearFrom"),
        include_authored=request.args.get("includeAuthored", "false").lower() == "true",
        include_published=request.args.get("includePublished", "false").lower() == "true",
        include_affiliations=request.args.get("includeAffiliations", "false").lower() == "true",
    )

    if result is None:
        return jsonify({"message": "Author not found."}), 404

    return jsonify(result)


@app.get("/api/query/h-index")
def h_index():
    minimum = int(request.args.get("minimum", 5))
    return jsonify(get_h_index_report(minimum))


@app.get("/api/query/q1-influence")
def q1_influence():
    return jsonify(get_q1_influence_network())

@app.get("/api/query/influential-authors")
def influential_authors():
    limit = int(request.args.get("limit", 10))
    year_from = optional_int_arg("yearFrom")
    q1_only = request.args.get("q1Only", "false").lower() == "true"
    return jsonify(get_influential_authors(limit=limit, year_from=year_from, q1_only=q1_only))


@app.get("/api/query/institution-collaboration")
def institution_collaboration():
    return jsonify(get_institution_collaboration_ranking())


@app.get("/api/query/shortest-path")
def shortest_path():
    source_author_id = int(request.args["sourceAuthorId"])
    target_author_id = int(request.args["targetAuthorId"])
    result = get_shortest_collaboration_path(source_author_id, target_author_id)
    if result is None:
        return jsonify({"message": "No collaboration path was found."}), 404
    return jsonify(result)


@app.get("/api/search")
def api_search():
    search_type = request.args.get("type", "authors")
    q = request.args.get("q", "")
    year_from = optional_int_arg("yearFrom")
    year_to = optional_int_arg("yearTo")
    quartile = request.args.get("quartile") or None
    q1_only = request.args.get("q1Only", "false").lower() == "true"
    country = request.args.get("country") or None
    venue_kind = request.args.get("venueKind") or None
    return jsonify(
        advanced_search(
            search_type=search_type,
            query=q,
            year_from=year_from,
            year_to=year_to,
            quartile=quartile,
            q1_only=q1_only,
            country=country,
            venue_kind=venue_kind,
        )
    )


@app.get("/api/search/suggestions")
def api_search_suggestions():
    return jsonify(search_suggestions(request.args.get("type", "authors"), request.args.get("q", "")))


@app.get("/api/reference-data")
def reference_data():
    return jsonify(list_reference_data())

@app.get("/api/institutions/<int:institution_id>/authors")
def api_institution_authors(institution_id):
    return jsonify(get_authors_by_institution(institution_id))


@app.get("/api/nodes/<int:node_id>")
def api_node_details(node_id):
    result = get_node_details(node_id)
    if result is None:
        return jsonify({"message": "Node not found."}), 404
    return jsonify(result)


@app.post("/api/institutions")
def api_create_institution():
    return jsonify(create_institution(request.get_json(force=True))), 201


@app.put("/api/institutions/<int:institution_id>")
def api_update_institution(institution_id):
    return jsonify(update_institution(institution_id, request.get_json(force=True)))


@app.delete("/api/institutions/<int:institution_id>")
def api_delete_institution(institution_id):
    delete_institution(institution_id)
    return jsonify({"ok": True})


@app.post("/api/authors")
def api_create_author():
    return jsonify(create_author(request.get_json(force=True))), 201


@app.put("/api/authors/<int:author_id>")
def api_update_author(author_id):
    return jsonify(update_author(author_id, request.get_json(force=True)))


@app.delete("/api/authors/<int:author_id>")
def api_delete_author(author_id):
    delete_author(author_id)
    return jsonify({"ok": True})


@app.post("/api/venues")
def api_create_venue():
    return jsonify(create_venue(request.get_json(force=True))), 201


@app.put("/api/venues/<int:venue_id>")
def api_update_venue(venue_id):
    return jsonify(update_venue(venue_id, request.get_json(force=True)))


@app.delete("/api/venues/<int:venue_id>")
def api_delete_venue(venue_id):
    delete_venue(venue_id)
    return jsonify({"ok": True})


@app.post("/api/publications")
def api_create_publication():
    return jsonify(create_publication(request.get_json(force=True))), 201


@app.put("/api/publications/<int:publication_id>")
def api_update_publication(publication_id):
    return jsonify(update_publication(publication_id, request.get_json(force=True)))


@app.delete("/api/publications/<int:publication_id>")
def api_delete_publication(publication_id):
    delete_publication(publication_id)
    return jsonify({"ok": True})

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
