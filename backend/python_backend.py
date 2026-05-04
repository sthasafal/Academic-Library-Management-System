from __future__ import annotations

import json
import os
import sqlite3
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DB_PATH = Path(os.environ.get("GRAPH_DB_PATH", PROJECT_DIR / "data" / "academic_graph.db"))
SCHEMA_PATH = PROJECT_DIR / "database" / "schema.sql"
SEED_DATA_PATH = PROJECT_DIR / "database" / "seed_data.json"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def build_citation_pairs(publications: list[dict]) -> list[tuple[int, int]]:
    sorted_publications = sorted(publications, key=lambda publication: (publication["year"], publication["id"]))
    pairs: list[tuple[int, int]] = []
    boosted_publication_ids = {301, 302, 303, 304, 305, 307, 310, 314}

    for index, publication in enumerate(sorted_publications):
        earlier_publications = sorted_publications[:index]
        if not earlier_publications:
            continue

        same_venue = [candidate for candidate in earlier_publications if candidate["venueId"] == publication["venueId"]]
        shared_author = [
            candidate
            for candidate in earlier_publications
            if any(author_id in publication["authorIds"] for author_id in candidate["authorIds"])
        ]
        boosted_candidates = [candidate for candidate in earlier_publications if candidate["id"] in boosted_publication_ids]
        midpoint = earlier_publications[len(earlier_publications) // 2] if earlier_publications else None
        candidate_ids = [
            earlier_publications[-1]["id"] if len(earlier_publications) >= 1 else None,
            earlier_publications[-2]["id"] if len(earlier_publications) >= 2 else None,
            same_venue[-1]["id"] if same_venue else None,
            shared_author[-1]["id"] if shared_author else None,
            midpoint["id"] if midpoint else None,
        ]
        candidate_ids.extend(candidate["id"] for candidate in boosted_candidates[-5:])

        for target_id in dict.fromkeys(value for value in candidate_ids if value is not None):
            if target_id != publication["id"]:
                pairs.append((publication["id"], target_id))

    return pairs


SEED_DATA = json.loads(SEED_DATA_PATH.read_text())
GRAPHS = SEED_DATA["graphs"]
INSTITUTIONS = SEED_DATA["institutions"]
AUTHORS = SEED_DATA["authors"]
VENUES = SEED_DATA["venues"]
PUBLICATIONS = SEED_DATA["publications"]
CITATION_PAIRS = build_citation_pairs(PUBLICATIONS)


def get_db_path() -> Path:
    return DB_PATH


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def migrate_schema(connection: sqlite3.Connection) -> None:
    node_columns = connection.execute("PRAGMA table_info(Nodes)").fetchall()
    has_attributes_json = any(row["name"] == "AttributesJson" for row in node_columns)

    if not has_attributes_json:
        connection.execute(
            """
            ALTER TABLE Nodes
            ADD COLUMN AttributesJson TEXT NOT NULL DEFAULT '{}'
            """
        )
        connection.commit()


def serialize_node_attributes(node_type: str, record: dict) -> str:
    if node_type == "Institution":
        payload = {"name": record["name"], "country": record["country"]}
    elif node_type == "Author":
        payload = {
            "fullName": record["fullName"],
            "researchArea": record["researchArea"],
            "email": record["email"],
            "institutionId": record["institutionId"],
        }
    elif node_type == "Venue":
        payload = {
            "name": record["name"],
            "venueKind": record["kind"],
            "quartile": record["quartile"],
            "impactScore": record["impactScore"],
        }
    else:
        payload = {
            "title": record["title"],
            "publicationYear": record["year"],
            "doi": record["doi"],
            "venueId": record["venueId"],
            "authorIds": record["authorIds"],
        }
    return json.dumps(payload)


def compute_h_index(citation_counts: list[int]) -> int:
    h_index = 0
    for index, count in enumerate(sorted(citation_counts, reverse=True), start=1):
        if count >= index:
            h_index = index
        else:
            break
    return h_index


def build_coauthor_pairs() -> list[dict]:
    pairs: dict[tuple[int, int], dict] = {}
    for publication in PUBLICATIONS:
        author_ids = publication["authorIds"]
        for index, source_id in enumerate(author_ids):
            for target_id in author_ids[index + 1:]:
                source = min(source_id, target_id)
                target = max(source_id, target_id)
                key = (source, target)
                pair = pairs.get(key, {"source": source, "target": target, "sharedCount": 0, "latestYear": publication["year"]})
                pair["sharedCount"] += 1
                pair["latestYear"] = max(pair["latestYear"], publication["year"])
                pairs[key] = pair
    return list(pairs.values())


def seed_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        DELETE FROM EdgeGraphs;
        DELETE FROM NodeGraphs;
        DELETE FROM Edges;
        DELETE FROM Authors;
        DELETE FROM Institutions;
        DELETE FROM Publications;
        DELETE FROM Venues;
        DELETE FROM Nodes;
        DELETE FROM Graphs;
        """
    )

    connection.executemany(
        "INSERT INTO Graphs (GraphID, GraphName, Description) VALUES (:id, :name, :description)",
        GRAPHS,
    )

    for institution in INSTITUTIONS:
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (institution["id"], "Institution", institution["name"], serialize_node_attributes("Institution", institution)),
        )
        connection.execute("INSERT INTO Institutions (NodeID, Name, Country) VALUES (?, ?, ?)", (institution["id"], institution["name"], institution["country"]))

    for author in AUTHORS:
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (author["id"], "Author", author["fullName"], serialize_node_attributes("Author", author)),
        )
        connection.execute(
            "INSERT INTO Authors (NodeID, FullName, ResearchArea, Email) VALUES (?, ?, ?, ?)",
            (author["id"], author["fullName"], author["researchArea"], author["email"]),
        )

    for venue in VENUES:
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (venue["id"], "Venue", venue["name"], serialize_node_attributes("Venue", venue)),
        )
        connection.execute(
            "INSERT INTO Venues (NodeID, Name, VenueKind, Quartile, ImpactScore) VALUES (?, ?, ?, ?, ?)",
            (venue["id"], venue["name"], venue["kind"], venue["quartile"], venue["impactScore"]),
        )

    for publication in PUBLICATIONS:
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (publication["id"], "Publication", publication["title"], serialize_node_attributes("Publication", publication)),
        )
        connection.execute(
            "INSERT INTO Publications (NodeID, Title, PublicationYear, DOI) VALUES (?, ?, ?, ?)",
            (publication["id"], publication["title"], publication["year"], publication["doi"]),
        )

    edge_id = 1
    for author in AUTHORS:
        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                author["id"],
                author["institutionId"],
                "AFFILIATED_WITH",
                2020,
                1,
                json.dumps({"role": "faculty", "startYear": 2020, "endYear": None}),
            ),
        )
        edge_id += 1

    for publication in PUBLICATIONS:
        for author_order, author_id in enumerate(publication["authorIds"], start=1):
            connection.execute(
                """
                INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    edge_id,
                    author_id,
                    publication["id"],
                    "AUTHORED",
                    publication["year"],
                    1,
                    json.dumps({"contribution": "co-author", "authorOrder": author_order, "isLeadAuthor": author_order == 1}),
                ),
            )
            edge_id += 1

        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                publication["id"],
                publication["venueId"],
                "PUBLISHED_IN",
                publication["year"],
                1,
                json.dumps({"venueYear": publication["year"], "peerReviewed": True}),
            ),
        )
        edge_id += 1

    for pair in build_coauthor_pairs():
        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                pair["source"],
                pair["target"],
                "CO_AUTHOR",
                pair["latestYear"],
                pair["sharedCount"],
                json.dumps(
                    {
                        "sharedPublications": pair["sharedCount"],
                        "strengthBand": classify_collaboration_strength(pair["sharedCount"]),
                    }
                ),
            ),
        )
        edge_id += 1

    publication_years = {publication["id"]: publication["year"] for publication in PUBLICATIONS}
    for source, target in CITATION_PAIRS:
        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                edge_id,
                source,
                target,
                "CITES",
                publication_years[source],
                1,
                json.dumps({"relation": "citation", "context": "Background or supporting work"}),
            ),
        )
        edge_id += 1

    author_ids = [author["id"] for author in AUTHORS]
    institution_ids = [institution["id"] for institution in INSTITUTIONS]
    publication_ids = [publication["id"] for publication in PUBLICATIONS]
    venue_ids = [venue["id"] for venue in VENUES]

    for node_id in [*author_ids, *institution_ids, *publication_ids]:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (1, node_id))

    for node_id in publication_ids:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (2, node_id))

    for node_id in [*author_ids, *publication_ids, *venue_ids]:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (3, node_id))

    for edge_id_value, edge_type in connection.execute("SELECT EdgeID, EdgeType FROM Edges ORDER BY EdgeID"):
        if edge_type in ("CO_AUTHOR", "AFFILIATED_WITH", "AUTHORED"):
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (1, edge_id_value))
        if edge_type == "CITES":
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (2, edge_id_value))
        if edge_type in ("AUTHORED", "PUBLISHED_IN", "CO_AUTHOR"):
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (3, edge_id_value))

    connection.commit()


def ensure_database(force: bool = False) -> None:
    connection = get_connection()
    try:
        connection.executescript(SCHEMA_PATH.read_text())
        migrate_schema(connection)
        if force:
            seed_database(connection)
            return

        row = connection.execute("SELECT COUNT(*) AS count FROM Nodes").fetchone()
        if row["count"] == 0:
            seed_database(connection)
    finally:
        connection.close()


def row_to_graph_node(row: sqlite3.Row, **extra: object) -> dict:
    active_extra = {key: value for key, value in extra.items() if value is not False and value is not None}
    return {"id": row["NodeID"], "label": row["DisplayLabel"], "type": row["NodeType"], **active_extra}


def row_to_graph_edge(row: sqlite3.Row) -> dict:
    return {
        "id": row["EdgeID"],
        "source": row["SourceNodeID"],
        "target": row["TargetNodeID"],
        "type": row["EdgeType"],
        "year": row["EdgeYear"],
        "weight": row["Weight"],
    }


def get_overview_stats() -> dict:
    connection = get_connection()
    try:
        nodes = connection.execute("SELECT NodeType, COUNT(*) AS total FROM Nodes GROUP BY NodeType").fetchall()
        edges = connection.execute("SELECT COUNT(*) AS total FROM Edges").fetchone()
        return {
            "authors": next((row["total"] for row in nodes if row["NodeType"] == "Author"), 0),
            "publications": next((row["total"] for row in nodes if row["NodeType"] == "Publication"), 0),
            "venues": next((row["total"] for row in nodes if row["NodeType"] == "Venue"), 0),
            "relationships": edges["total"],
        }
    finally:
        connection.close()


def list_graphs() -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              g.GraphID,
              g.GraphName,
              g.Description,
              COUNT(DISTINCT ng.NodeID) AS nodeCount,
              COUNT(DISTINCT eg.EdgeID) AS edgeCount
            FROM Graphs g
            LEFT JOIN NodeGraphs ng
              ON ng.GraphID = g.GraphID
            LEFT JOIN EdgeGraphs eg
              ON eg.GraphID = g.GraphID
            GROUP BY g.GraphID, g.GraphName, g.Description
            ORDER BY g.GraphID
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def list_authors() -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              a.NodeID,
              a.FullName,
              a.ResearchArea,
              a.Email,
              i.NodeID AS institutionId,
              i.Name AS institutionName
            FROM Authors a
            JOIN Institutions i
              ON i.NodeID = (
                SELECT e.TargetNodeID
                FROM Edges e
                WHERE e.SourceNodeID = a.NodeID
                  AND e.EdgeType = 'AFFILIATED_WITH'
                LIMIT 1
              )
            ORDER BY a.FullName
            """
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def search_authors(query: str) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT a.NodeID, a.FullName, a.ResearchArea, i.Name AS institutionName
            FROM Authors a
            JOIN Institutions i
              ON i.NodeID = (
                SELECT e.TargetNodeID
                FROM Edges e
                WHERE e.SourceNodeID = a.NodeID
                  AND e.EdgeType = 'AFFILIATED_WITH'
                LIMIT 1
              )
            WHERE a.FullName LIKE ?
            ORDER BY a.FullName
            """,
            (f"%{query}%",),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def search_publications(query: str) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              p.NodeID AS publicationId,
              p.Title AS title,
              p.PublicationYear AS publicationYear,
              p.DOI AS doi,
              v.Name AS venueName,
              v.VenueKind AS venueKind,
              v.Quartile AS quartile,
              v.ImpactScore AS impactScore,
              GROUP_CONCAT(a.FullName, ', ') AS authors
            FROM Publications p
            JOIN Edges published
              ON published.SourceNodeID = p.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            JOIN Venues v
              ON v.NodeID = published.TargetNodeID
            JOIN Edges authored
              ON authored.TargetNodeID = p.NodeID
             AND authored.EdgeType = 'AUTHORED'
            JOIN Authors a
              ON a.NodeID = authored.SourceNodeID
            WHERE p.Title LIKE ?
            GROUP BY p.NodeID, p.Title, p.PublicationYear, p.DOI, v.Name, v.VenueKind, v.Quartile, v.ImpactScore
            ORDER BY p.PublicationYear DESC, p.Title
            """,
            (f"%{query}%",),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def search_institutions(query: str) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              i.NodeID AS institutionId,
              i.Name AS name,
              i.Country AS country,
              COUNT(a.NodeID) AS authorCount
            FROM Institutions i
            LEFT JOIN Edges e
              ON e.TargetNodeID = i.NodeID
             AND e.EdgeType = 'AFFILIATED_WITH'
            LEFT JOIN Authors a
              ON a.NodeID = e.SourceNodeID
            WHERE i.Name LIKE ?
            GROUP BY i.NodeID, i.Name, i.Country
            ORDER BY i.Name
            """,
            (f"%{query}%",),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def search_venues(query: str) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              v.NodeID AS venueId,
              v.Name AS name,
              v.VenueKind AS venueKind,
              v.Quartile AS quartile,
              v.ImpactScore AS impactScore,
              COUNT(p.NodeID) AS publicationCount
            FROM Venues v
            LEFT JOIN Edges e
              ON e.TargetNodeID = v.NodeID
             AND e.EdgeType = 'PUBLISHED_IN'
            LEFT JOIN Publications p
              ON p.NodeID = e.SourceNodeID
            WHERE v.Name LIKE ?
            GROUP BY v.NodeID, v.Name, v.VenueKind, v.Quartile, v.ImpactScore
            ORDER BY v.Name
            """,
            (f"%{query}%",),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def get_authors_by_institution(institution_id: int) -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              a.NodeID,
              a.FullName,
              a.ResearchArea,
              a.Email,
              i.Name AS institutionName
            FROM Authors a
            JOIN Edges e
              ON e.SourceNodeID = a.NodeID
             AND e.EdgeType = 'AFFILIATED_WITH'
            JOIN Institutions i
              ON i.NodeID = e.TargetNodeID
            WHERE i.NodeID = ?
            ORDER BY a.FullName
            """,
            (institution_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()

def list_collections() -> dict:
    connection = get_connection()
    try:
        publication_rows = connection.execute(
            """
            SELECT
              p.NodeID AS publicationId,
              p.Title AS title,
              p.PublicationYear AS publicationYear,
              p.DOI AS doi,
              v.Name AS venueName,
              v.VenueKind AS venueKind,
              v.Quartile AS quartile,
              v.ImpactScore AS impactScore,
              GROUP_CONCAT(a.FullName, ', ') AS authors
            FROM Publications p
            JOIN Edges published
              ON published.SourceNodeID = p.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            JOIN Venues v
              ON v.NodeID = published.TargetNodeID
            JOIN Edges authored
              ON authored.TargetNodeID = p.NodeID
             AND authored.EdgeType = 'AUTHORED'
            JOIN Authors a
              ON a.NodeID = authored.SourceNodeID
            GROUP BY p.NodeID, p.Title, p.PublicationYear, p.DOI, v.Name, v.VenueKind, v.Quartile, v.ImpactScore
            ORDER BY p.PublicationYear DESC, p.Title
            """
        ).fetchall()

        venue_rows = connection.execute(
            """
            SELECT
              v.NodeID AS venueId,
              v.Name AS name,
              v.VenueKind AS venueKind,
              v.Quartile AS quartile,
              v.ImpactScore AS impactScore,
              COUNT(p.NodeID) AS publicationCount
            FROM Venues v
            LEFT JOIN Edges published
              ON published.TargetNodeID = v.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            LEFT JOIN Publications p
              ON p.NodeID = published.SourceNodeID
            GROUP BY v.NodeID, v.Name, v.VenueKind, v.Quartile, v.ImpactScore
            ORDER BY v.ImpactScore DESC, v.Name
            """
        ).fetchall()

        return {
            "publications": [dict(row) for row in publication_rows],
            "venues": [dict(row) for row in venue_rows],
        }
    finally:
        connection.close()


def get_coauthor_network(
    author_id: object,
    year_from: int | None = None,
    include_authored: bool = False,
    include_published: bool = False,
    include_affiliations: bool = False,
) -> dict | None:
    connection = get_connection()
    try:
        normalized_author_id = int(author_id)
        author = connection.execute(
            """
            SELECT
              a.NodeID,
              a.FullName,
              a.ResearchArea,
              a.Email,
              i.Name AS institutionName,
              i.Country AS institutionCountry
            FROM Authors a
            JOIN Edges affiliation
              ON affiliation.SourceNodeID = a.NodeID
             AND affiliation.EdgeType = 'AFFILIATED_WITH'
            JOIN Institutions i
              ON i.NodeID = affiliation.TargetNodeID
            WHERE a.NodeID = ?
            """,
            (normalized_author_id,),
        ).fetchone()

        if author is None:
            return None

        coauthor_rows = connection.execute(
            """
            SELECT SourceNodeID, TargetNodeID
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
              AND (SourceNodeID = ? OR TargetNodeID = ?)
              AND (? IS NULL OR EdgeYear >= ?)
            """,
            (normalized_author_id, normalized_author_id, year_from, year_from),
        ).fetchall()

        node_ids = {normalized_author_id}
        for row in coauthor_rows:
            node_ids.add(row["SourceNodeID"])
            node_ids.add(row["TargetNodeID"])

        placeholders = ", ".join("?" for _ in node_ids)
        params = tuple(node_ids)
        edge_rows = connection.execute(
            f"""
            SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
              AND SourceNodeID IN ({placeholders})
              AND TargetNodeID IN ({placeholders})
              AND (? IS NULL OR EdgeYear >= ?)
            ORDER BY Weight DESC, EdgeID
            """,
            (*params, *params, year_from, year_from),
        ).fetchall()

        collaborator_rows = connection.execute(
            """
            SELECT
              collaborator.NodeID AS authorId,
              collaborator.FullName AS authorName,
              collaborator.ResearchArea AS researchArea,
              institution.Name AS institutionName,
              coauthor.Weight AS sharedPublications,
              coauthor.EdgeYear AS latestYear
            FROM Edges coauthor
            JOIN Authors collaborator
              ON collaborator.NodeID = CASE
                WHEN coauthor.SourceNodeID = ? THEN coauthor.TargetNodeID
                ELSE coauthor.SourceNodeID
              END
            JOIN Edges affiliation
              ON affiliation.SourceNodeID = collaborator.NodeID
             AND affiliation.EdgeType = 'AFFILIATED_WITH'
            JOIN Institutions institution
              ON institution.NodeID = affiliation.TargetNodeID
            WHERE coauthor.EdgeType = 'CO_AUTHOR'
              AND (coauthor.SourceNodeID = ? OR coauthor.TargetNodeID = ?)
            ORDER BY coauthor.Weight DESC, collaborator.FullName
            """,
            (normalized_author_id, normalized_author_id, normalized_author_id),
        ).fetchall()

        shared_publication_rows = connection.execute(
            """
            SELECT
              other_authored.SourceNodeID AS collaboratorId,
              p.Title AS title,
              p.PublicationYear AS publicationYear
            FROM Edges selected_authored
            JOIN Edges other_authored
              ON other_authored.TargetNodeID = selected_authored.TargetNodeID
             AND other_authored.EdgeType = 'AUTHORED'
             AND other_authored.SourceNodeID != ?
            JOIN Publications p
              ON p.NodeID = selected_authored.TargetNodeID
            WHERE selected_authored.EdgeType = 'AUTHORED'
              AND selected_authored.SourceNodeID = ?
            ORDER BY p.PublicationYear DESC, p.Title
            """,
            (normalized_author_id, normalized_author_id),
        ).fetchall()

        shared_publications_by_author: dict[int, list[dict]] = {}
        for row in shared_publication_rows:
            shared_publications_by_author.setdefault(row["collaboratorId"], []).append(
                {"title": row["title"], "publicationYear": row["publicationYear"]}
            )

        collaborators = []
        for row in collaborator_rows:
            collaborator = dict(row)
            collaborator["sharedPublicationsList"] = shared_publications_by_author.get(row["authorId"], [])
            collaborators.append(collaborator)

        publication_rows = connection.execute(
            """
            SELECT
              p.NodeID AS publicationId,
              p.Title AS title,
              p.PublicationYear AS publicationYear,
              p.DOI AS doi,
              v.Name AS venueName,
              v.Quartile AS quartile,
              COUNT(DISTINCT citation.EdgeID) AS citationCount,
              GROUP_CONCAT(DISTINCT other_author.FullName) AS coauthors
            FROM Edges authored
            JOIN Publications p
              ON p.NodeID = authored.TargetNodeID
            JOIN Edges published
              ON published.SourceNodeID = p.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            JOIN Venues v
              ON v.NodeID = published.TargetNodeID
            LEFT JOIN Edges citation
              ON citation.TargetNodeID = p.NodeID
             AND citation.EdgeType = 'CITES'
            LEFT JOIN Edges other_authored
              ON other_authored.TargetNodeID = p.NodeID
             AND other_authored.EdgeType = 'AUTHORED'
             AND other_authored.SourceNodeID != ?
            LEFT JOIN Authors other_author
              ON other_author.NodeID = other_authored.SourceNodeID
            WHERE authored.EdgeType = 'AUTHORED'
              AND authored.SourceNodeID = ?
            GROUP BY p.NodeID, p.Title, p.PublicationYear, p.DOI, v.Name, v.Quartile
            ORDER BY p.PublicationYear DESC, p.Title
            """,
            (normalized_author_id, normalized_author_id),
        ).fetchall()

        publications = [dict(row) for row in publication_rows]
        total_shared_publications = int(sum(float(row["sharedPublications"] or 0) for row in collaborators))
        strongest_collaborator = collaborators[0] if collaborators else None
        visual_node_ids = set(node_ids)
        visual_edge_rows = list(edge_rows)

        if include_affiliations and params:
            affiliation_rows = connection.execute(
                f"""
                SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
                FROM Edges
                WHERE EdgeType = 'AFFILIATED_WITH'
                  AND SourceNodeID IN ({placeholders})
                ORDER BY EdgeID
                """,
                params,
            ).fetchall()
            for row in affiliation_rows:
                visual_edge_rows.append(row)
                visual_node_ids.add(row["TargetNodeID"])

        publication_node_ids: set[int] = set()
        if (include_authored or include_published) and params:
            authored_rows = connection.execute(
                f"""
                SELECT
                  authored.EdgeID,
                  authored.SourceNodeID,
                  authored.TargetNodeID,
                  authored.EdgeType,
                  authored.EdgeYear,
                  authored.Weight
                FROM Edges authored
                JOIN Publications p
                  ON p.NodeID = authored.TargetNodeID
                WHERE authored.EdgeType = 'AUTHORED'
                  AND authored.SourceNodeID IN ({placeholders})
                  AND (? IS NULL OR p.PublicationYear >= ?)
                ORDER BY p.PublicationYear DESC, authored.EdgeID
                """,
                (*params, year_from, year_from),
            ).fetchall()
            for row in authored_rows:
                publication_node_ids.add(row["TargetNodeID"])
                visual_node_ids.add(row["TargetNodeID"])
                if include_authored:
                    visual_edge_rows.append(row)

        if include_published and publication_node_ids:
            publication_placeholders = ", ".join("?" for _ in publication_node_ids)
            publication_params = tuple(publication_node_ids)
            published_rows = connection.execute(
                f"""
                SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
                FROM Edges
                WHERE EdgeType = 'PUBLISHED_IN'
                  AND SourceNodeID IN ({publication_placeholders})
                ORDER BY EdgeID
                """,
                publication_params,
            ).fetchall()
            for row in published_rows:
                visual_edge_rows.append(row)
                visual_node_ids.add(row["TargetNodeID"])

        visual_placeholders = ", ".join("?" for _ in visual_node_ids)
        visual_node_rows = connection.execute(
            f"""
            SELECT NodeID, NodeType, DisplayLabel
            FROM Nodes
            WHERE NodeID IN ({visual_placeholders})
            ORDER BY DisplayLabel
            """,
            tuple(visual_node_ids),
        ).fetchall()

        return {
            "author": dict(author),
            "nodes": [row_to_graph_node(row, isFocus=row["NodeID"] == normalized_author_id) for row in visual_node_rows],
            "edges": [row_to_graph_edge(row) for row in visual_edge_rows],
            "summary": {
                "directCoauthors": len(collaborators),
                "publicationCount": len(publications),
                "sharedPublications": total_shared_publications,
                "institutionName": author["institutionName"],
                "strongestCollaboration": (
                    {
                        "authorName": strongest_collaborator["authorName"],
                        "sharedPublications": strongest_collaborator["sharedPublications"],
                    }
                    if strongest_collaborator
                    else None
                ),
            },
            "collaborators": collaborators,
            "publications": publications,
            "definition": "One-hop co-author network centered on the selected author. Edge weight equals the number of shared publications.",
        }
    finally:
        connection.close()


def load_author_publication_metrics() -> list[sqlite3.Row]:
    connection = get_connection()
    try:
        return connection.execute(
            """
            SELECT
              a.NodeID AS authorId,
              a.FullName AS authorName,
              p.NodeID AS publicationId,
              p.Title AS publicationTitle,
              p.PublicationYear,
              v.Name AS venueName,
              v.Quartile,
              COUNT(c.EdgeID) AS citationCount
            FROM Authors a
            JOIN Edges authored
              ON authored.SourceNodeID = a.NodeID
             AND authored.EdgeType = 'AUTHORED'
            JOIN Publications p
              ON p.NodeID = authored.TargetNodeID
            JOIN Edges published
              ON published.SourceNodeID = p.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            JOIN Venues v
              ON v.NodeID = published.TargetNodeID
            LEFT JOIN Edges c
              ON c.TargetNodeID = p.NodeID
             AND c.EdgeType = 'CITES'
            GROUP BY a.NodeID, a.FullName, p.NodeID, p.Title, p.PublicationYear, v.Name, v.Quartile
            ORDER BY a.FullName, p.PublicationYear, p.Title
            """
        ).fetchall()
    finally:
        connection.close()


def list_authors_by_h_index(minimum: int = 5) -> list[dict]:
    grouped: dict[int, dict] = {}
    for row in load_author_publication_metrics():
        author = grouped.setdefault(
            row["authorId"],
            {"authorId": row["authorId"], "authorName": row["authorName"], "publicationVenues": set(), "publications": []},
        )
        author["publicationVenues"].add(row["venueName"])
        author["publications"].append(
            {
                "publicationId": row["publicationId"],
                "title": row["publicationTitle"],
                "publicationYear": row["PublicationYear"],
                "venueName": row["venueName"],
                "quartile": row["Quartile"],
                "citationCount": row["citationCount"],
            }
        )

    authors = []
    for author in grouped.values():
        authors.append(
            {
                "authorId": author["authorId"],
                "authorName": author["authorName"],
                "hIndex": compute_h_index([publication["citationCount"] for publication in author["publications"]]),
                "publicationVenues": sorted(author["publicationVenues"]),
                "publications": sorted(author["publications"], key=lambda publication: publication["citationCount"], reverse=True),
            }
        )

    return sorted(
        [author for author in authors if author["hIndex"] >= minimum],
        key=lambda author: (-author["hIndex"], author["authorName"]),
    )


def get_h_index_report(minimum: int = 5) -> dict:
    return {
        "minimum": minimum,
        "definition": (
            "An author has h-index = h when at least h of their publications each have at least h incoming "
            "CITES edges in the citation graph. This query returns authors with h-index greater than or equal "
            f"to {minimum}."
        ),
        "authors": list_authors_by_h_index(minimum),
    }


def get_q1_influence_network() -> dict:
    connection = get_connection()
    try:
        q1_rows = connection.execute(
            """
            SELECT DISTINCT authored.SourceNodeID AS authorId
            FROM Edges authored
            JOIN Edges published
              ON published.SourceNodeID = authored.TargetNodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            JOIN Venues v
              ON v.NodeID = published.TargetNodeID
            WHERE authored.EdgeType = 'AUTHORED'
              AND v.Quartile = 'Q1'
            """
        ).fetchall()
        q1_set = {row["authorId"] for row in q1_rows}

        edge_rows = connection.execute(
            """
            SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
            ORDER BY Weight DESC, EdgeID
            """
        ).fetchall()

        qualifying: set[int] = set()
        linked_by: dict[int, list[int]] = {}
        for row in edge_rows:
            if row["SourceNodeID"] in q1_set:
                qualifying.add(row["TargetNodeID"])
                linked_by.setdefault(row["TargetNodeID"], []).append(row["SourceNodeID"])
            if row["TargetNodeID"] in q1_set:
                qualifying.add(row["SourceNodeID"])
                linked_by.setdefault(row["SourceNodeID"], []).append(row["TargetNodeID"])

        network_ids = list({*q1_set, *qualifying})
        placeholders = ", ".join("?" for _ in network_ids)
        node_rows = connection.execute(
            f"""
            SELECT NodeID, NodeType, DisplayLabel
            FROM Nodes
            WHERE NodeID IN ({placeholders})
            ORDER BY DisplayLabel
            """,
            tuple(network_ids),
        ).fetchall()

        network_edges = connection.execute(
            f"""
            SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
              AND SourceNodeID IN ({placeholders})
              AND TargetNodeID IN ({placeholders})
            ORDER BY Weight DESC, EdgeID
            """,
            (*network_ids, *network_ids),
        ).fetchall()

        labels = {row["NodeID"]: row["DisplayLabel"] for row in node_rows}
        qualifying_authors = [
            {
                "authorId": author_id,
                "authorName": labels[author_id],
                "linkedToQ1Authors": sorted({labels[value] for value in linked_by.get(author_id, [])}),
            }
            for author_id in sorted(qualifying, key=lambda value: labels[value])
        ]

        return {
            "definition": "A Q1 journal is any venue stored with Quartile = 'Q1' in the Venues table. A qualifying author has a direct CO_AUTHOR edge to at least one author who has published in a Q1 venue.",
            "qualifyingAuthors": qualifying_authors,
            "nodes": [row_to_graph_node(row, isQ1Publisher=row["NodeID"] in q1_set, isInfluencedAuthor=row["NodeID"] in qualifying) for row in node_rows],
            "edges": [row_to_graph_edge(row) for row in network_edges],
        }
    finally:
        connection.close()


def validate_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("Enter a valid email address.")
    return email


def normalize_text(value: object, field_name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field_name} is required.")
    return text


def normalize_optional_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None


def normalize_integer(value: object, field_name: str, minimum: int | None = None) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be a valid integer.") from error

    if minimum is not None and number < minimum:
        raise ValueError(f"{field_name} must be greater than or equal to {minimum}.")
    return number


def normalize_float(value: object, field_name: str, minimum: float | None = None) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field_name} must be a valid number.") from error

    if minimum is not None and number < minimum:
        raise ValueError(f"{field_name} must be greater than or equal to {minimum}.")
    return number


def normalize_quartile(value: object) -> str | None:
    quartile = normalize_optional_text(value)
    if quartile is None:
        return None
    quartile = quartile.upper()
    if quartile not in {"Q1", "Q2", "Q3", "Q4"}:
        raise ValueError("Quartile must be Q1, Q2, Q3, Q4, or blank.")
    return quartile


def normalize_venue_kind(value: object) -> str:
    kind = normalize_text(value, "Venue kind").title()
    if kind not in {"Journal", "Conference"}:
        raise ValueError("Venue kind must be Journal or Conference.")
    return kind


def normalize_id_list(values: object, field_name: str) -> list[int]:
    if not isinstance(values, list):
        raise ValueError(f"{field_name} must be provided as a list.")
    normalized = []
    for value in values:
        number = normalize_integer(value, field_name, minimum=1)
        if number not in normalized:
            normalized.append(number)
    return normalized


def classify_collaboration_strength(shared_count: int) -> str:
    if shared_count >= 4:
        return "strong"
    if shared_count >= 2:
        return "medium"
    return "light"


def get_next_id(connection: sqlite3.Connection, table: str, column: str) -> int:
    row = connection.execute(f"SELECT COALESCE(MAX({column}), 0) + 1 AS nextId FROM {table}").fetchone()
    return int(row["nextId"])


def node_exists(connection: sqlite3.Connection, node_id: int, node_type: str | None = None) -> bool:
    if node_type is None:
        row = connection.execute("SELECT 1 FROM Nodes WHERE NodeID = ?", (node_id,)).fetchone()
    else:
        row = connection.execute(
            "SELECT 1 FROM Nodes WHERE NodeID = ? AND NodeType = ?",
            (node_id, node_type),
        ).fetchone()
    return row is not None


def require_node(connection: sqlite3.Connection, node_id: int, node_type: str) -> None:
    if not node_exists(connection, node_id, node_type):
        raise ValueError(f"{node_type} {node_id} was not found.")


def set_node_record(connection: sqlite3.Connection, node_id: int, node_type: str, label: str, attributes: dict) -> None:
    connection.execute(
        """
        UPDATE Nodes
        SET DisplayLabel = ?, AttributesJson = ?
        WHERE NodeID = ? AND NodeType = ?
        """,
        (label, json.dumps(attributes), node_id, node_type),
    )


def insert_edge(
    connection: sqlite3.Connection,
    source_node_id: int,
    target_node_id: int,
    edge_type: str,
    edge_year: int | None,
    weight: float,
    metadata: dict,
) -> int:
    edge_id = get_next_id(connection, "Edges", "EdgeID")
    connection.execute(
        """
        INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (edge_id, source_node_id, target_node_id, edge_type, edge_year, weight, json.dumps(metadata)),
    )
    return edge_id


def rebuild_coauthor_edges(connection: sqlite3.Connection) -> None:
    connection.execute("DELETE FROM Edges WHERE EdgeType = 'CO_AUTHOR'")
    rows = connection.execute(
        """
        SELECT
          p.NodeID AS publicationId,
          p.Title AS title,
          p.PublicationYear AS publicationYear,
          authored.SourceNodeID AS authorId
        FROM Publications p
        JOIN Edges authored
          ON authored.TargetNodeID = p.NodeID
         AND authored.EdgeType = 'AUTHORED'
        ORDER BY p.NodeID, authored.SourceNodeID
        """
    ).fetchall()

    publication_map: dict[int, dict] = {}
    for row in rows:
        publication = publication_map.setdefault(
            row["publicationId"],
            {"title": row["title"], "year": row["publicationYear"], "authorIds": []},
        )
        publication["authorIds"].append(row["authorId"])

    pairs: dict[tuple[int, int], dict] = {}
    for publication in publication_map.values():
        author_ids = sorted(set(publication["authorIds"]))
        for index, source_id in enumerate(author_ids):
            for target_id in author_ids[index + 1:]:
                key = (source_id, target_id)
                pair = pairs.get(
                    key,
                    {
                        "source": source_id,
                        "target": target_id,
                        "sharedCount": 0,
                        "latestYear": publication["year"],
                        "titles": [],
                    },
                )
                pair["sharedCount"] += 1
                pair["latestYear"] = max(pair["latestYear"], publication["year"])
                pair["titles"].append(publication["title"])
                pairs[key] = pair

    for pair in pairs.values():
        insert_edge(
            connection,
            pair["source"],
            pair["target"],
            "CO_AUTHOR",
            pair["latestYear"],
            pair["sharedCount"],
            {
                "sharedPublications": pair["sharedCount"],
                "recentTitles": pair["titles"][-3:],
                "strengthBand": classify_collaboration_strength(pair["sharedCount"]),
            },
        )


def rebuild_graph_memberships(connection: sqlite3.Connection) -> None:
    connection.execute("DELETE FROM NodeGraphs")
    connection.execute("DELETE FROM EdgeGraphs")

    author_ids = [row["NodeID"] for row in connection.execute("SELECT NodeID FROM Authors ORDER BY NodeID")]
    institution_ids = [row["NodeID"] for row in connection.execute("SELECT NodeID FROM Institutions ORDER BY NodeID")]
    publication_ids = [row["NodeID"] for row in connection.execute("SELECT NodeID FROM Publications ORDER BY NodeID")]
    venue_ids = [row["NodeID"] for row in connection.execute("SELECT NodeID FROM Venues ORDER BY NodeID")]

    for node_id in [*author_ids, *institution_ids, *publication_ids]:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (1, node_id))

    for node_id in publication_ids:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (2, node_id))

    for node_id in [*author_ids, *publication_ids, *venue_ids]:
        connection.execute("INSERT INTO NodeGraphs (GraphID, NodeID) VALUES (?, ?)", (3, node_id))

    for row in connection.execute("SELECT EdgeID, EdgeType FROM Edges ORDER BY EdgeID"):
        if row["EdgeType"] in ("CO_AUTHOR", "AFFILIATED_WITH", "AUTHORED"):
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (1, row["EdgeID"]))
        if row["EdgeType"] == "CITES":
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (2, row["EdgeID"]))
        if row["EdgeType"] in ("AUTHORED", "PUBLISHED_IN", "CO_AUTHOR"):
            connection.execute("INSERT INTO EdgeGraphs (GraphID, EdgeID) VALUES (?, ?)", (3, row["EdgeID"]))


def get_node_details(node_id: int) -> dict | None:
    connection = get_connection()
    try:
        node = connection.execute(
            "SELECT NodeID, NodeType, DisplayLabel, AttributesJson FROM Nodes WHERE NodeID = ?",
            (node_id,),
        ).fetchone()
        if node is None:
            return None

        graphs = connection.execute(
            """
            SELECT g.GraphID, g.GraphName
            FROM NodeGraphs ng
            JOIN Graphs g
              ON g.GraphID = ng.GraphID
            WHERE ng.NodeID = ?
            ORDER BY g.GraphID
            """,
            (node_id,),
        ).fetchall()
        edge_summary = connection.execute(
            """
            SELECT EdgeType, COUNT(*) AS total
            FROM Edges
            WHERE SourceNodeID = ? OR TargetNodeID = ?
            GROUP BY EdgeType
            ORDER BY EdgeType
            """,
            (node_id, node_id),
        ).fetchall()

        result = {
            "id": node["NodeID"],
            "type": node["NodeType"],
            "label": node["DisplayLabel"],
            "attributes": json.loads(node["AttributesJson"] or "{}"),
            "graphs": [dict(row) for row in graphs],
            "edgeSummary": [dict(row) for row in edge_summary],
        }

        if node["NodeType"] == "Publication":
            publication = connection.execute(
                """
                SELECT
                  p.NodeID AS publicationId,
                  p.Title AS title,
                  p.PublicationYear AS publicationYear,
                  p.DOI AS doi,
                  v.Name AS venueName,
                  v.Quartile AS quartile,
                  COUNT(DISTINCT citation.EdgeID) AS citationCount
                FROM Publications p
                JOIN Edges published
                  ON published.SourceNodeID = p.NodeID
                 AND published.EdgeType = 'PUBLISHED_IN'
                JOIN Venues v
                  ON v.NodeID = published.TargetNodeID
                LEFT JOIN Edges citation
                  ON citation.TargetNodeID = p.NodeID
                 AND citation.EdgeType = 'CITES'
                WHERE p.NodeID = ?
                GROUP BY p.NodeID, p.Title, p.PublicationYear, p.DOI, v.Name, v.Quartile
                """,
                (node_id,),
            ).fetchone()
            authors = connection.execute(
                """
                SELECT a.NodeID AS authorId, a.FullName AS authorName
                FROM Edges authored
                JOIN Authors a
                  ON a.NodeID = authored.SourceNodeID
                WHERE authored.EdgeType = 'AUTHORED'
                  AND authored.TargetNodeID = ?
                ORDER BY a.FullName
                """,
                (node_id,),
            ).fetchall()
            citation_targets = connection.execute(
                """
                SELECT TargetNodeID AS publicationId
                FROM Edges
                WHERE EdgeType = 'CITES'
                  AND SourceNodeID = ?
                ORDER BY TargetNodeID
                """,
                (node_id,),
            ).fetchall()
            result["details"] = {
                **dict(publication),
                "authors": [dict(row) for row in authors],
                "citationTargetIds": [row["publicationId"] for row in citation_targets],
            }
        elif node["NodeType"] == "Author":
            author = connection.execute(
                """
                SELECT
                  a.NodeID,
                  a.FullName,
                  a.ResearchArea,
                  a.Email,
                  i.Name AS institutionName,
                  i.Country AS institutionCountry
                FROM Authors a
                JOIN Edges affiliation
                  ON affiliation.SourceNodeID = a.NodeID
                 AND affiliation.EdgeType = 'AFFILIATED_WITH'
                JOIN Institutions i
                  ON i.NodeID = affiliation.TargetNodeID
                WHERE a.NodeID = ?
                """,
                (node_id,),
            ).fetchone()
            metrics = connection.execute(
                """
                SELECT
                  COUNT(DISTINCT authored.TargetNodeID) AS publicationCount,
                  COUNT(DISTINCT coauthor.EdgeID) AS coauthorCount
                FROM Authors a
                LEFT JOIN Edges authored
                  ON authored.SourceNodeID = a.NodeID
                 AND authored.EdgeType = 'AUTHORED'
                LEFT JOIN Edges coauthor
                  ON (coauthor.SourceNodeID = a.NodeID OR coauthor.TargetNodeID = a.NodeID)
                 AND coauthor.EdgeType = 'CO_AUTHOR'
                WHERE a.NodeID = ?
                """,
                (node_id,),
            ).fetchone()
            result["details"] = {**dict(author), **dict(metrics)}
        return result
    finally:
        connection.close()


def list_institutions() -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              i.NodeID AS institutionId,
              i.Name AS name,
              i.Country AS country,
              COUNT(DISTINCT affiliation.SourceNodeID) AS authorCount
            FROM Institutions i
            LEFT JOIN Edges affiliation
              ON affiliation.TargetNodeID = i.NodeID
             AND affiliation.EdgeType = 'AFFILIATED_WITH'
            GROUP BY i.NodeID, i.Name, i.Country
            ORDER BY i.Name
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def list_venues() -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              v.NodeID AS venueId,
              v.Name AS name,
              v.VenueKind AS venueKind,
              v.Quartile AS quartile,
              v.ImpactScore AS impactScore,
              COUNT(DISTINCT published.SourceNodeID) AS publicationCount
            FROM Venues v
            LEFT JOIN Edges published
              ON published.TargetNodeID = v.NodeID
             AND published.EdgeType = 'PUBLISHED_IN'
            GROUP BY v.NodeID, v.Name, v.VenueKind, v.Quartile, v.ImpactScore
            ORDER BY v.Name
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def list_publications() -> list[dict]:
    return list_collections()["publications"]


def list_reference_data() -> dict:
    return {
        "authors": list_authors(),
        "institutions": list_institutions(),
        "venues": list_venues(),
        "publications": list_publications(),
    }


def search_suggestions(search_type: str, query: str) -> list[dict]:
    connection = get_connection()
    try:
        node_type = {
            "authors": "Author",
            "publications": "Publication",
            "institutions": "Institution",
            "venues": "Venue",
        }.get(search_type)
        if node_type is None:
            return []
        rows = connection.execute(
            """
            SELECT NodeID AS id, DisplayLabel AS label, NodeType AS type
            FROM Nodes
            WHERE NodeType = ?
              AND DisplayLabel LIKE ?
            ORDER BY DisplayLabel
            LIMIT 8
            """,
            (node_type, f"%{query.strip()}%"),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def advanced_search(
    search_type: str,
    query: str = "",
    year_from: int | None = None,
    year_to: int | None = None,
    quartile: str | None = None,
    q1_only: bool = False,
    country: str | None = None,
    venue_kind: str | None = None,
) -> list[dict]:
    normalized_query = query.strip()

    if search_type == "authors":
        results = search_authors(normalized_query)
        if year_from is not None or q1_only:
            metric_rows = load_author_publication_metrics()
            allowed_author_ids = set()
            for row in metric_rows:
                if year_from is not None and row["PublicationYear"] < year_from:
                    continue
                if q1_only and row["Quartile"] != "Q1":
                    continue
                allowed_author_ids.add(row["authorId"])
            results = [author for author in results if author["NodeID"] in allowed_author_ids]
        return results

    if search_type == "publications":
        results = search_publications(normalized_query)
        filtered = []
        for publication in results:
            if year_from is not None and publication["publicationYear"] < year_from:
                continue
            if year_to is not None and publication["publicationYear"] > year_to:
                continue
            if quartile and publication["quartile"] != quartile:
                continue
            filtered.append(publication)
        return filtered

    if search_type == "institutions":
        results = search_institutions(normalized_query)
        if country:
            results = [institution for institution in results if institution["country"].lower() == country.lower()]
        return results

    if search_type == "venues":
        results = search_venues(normalized_query)
        filtered = []
        for venue in results:
            if quartile and venue["quartile"] != quartile:
                continue
            if venue_kind and venue["venueKind"].lower() != venue_kind.lower():
                continue
            filtered.append(venue)
        return filtered

    return []


def get_shortest_collaboration_path(source_author_id: int, target_author_id: int) -> dict | None:
    connection = get_connection()
    try:
        for author_id in (source_author_id, target_author_id):
            require_node(connection, author_id, "Author")

        if source_author_id == target_author_id:
            author = connection.execute("SELECT NodeID, DisplayLabel FROM Nodes WHERE NodeID = ?", (source_author_id,)).fetchone()
            return {
                "pathAuthorIds": [source_author_id],
                "pathAuthorNames": [author["DisplayLabel"]],
                "hopCount": 0,
                "nodes": [row_to_graph_node(author, isFocus=True)],
                "edges": [],
            }

        edge_rows = connection.execute(
            """
            SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
            """
        ).fetchall()
        adjacency: dict[int, list[tuple[int, sqlite3.Row]]] = {}
        for row in edge_rows:
            adjacency.setdefault(row["SourceNodeID"], []).append((row["TargetNodeID"], row))
            adjacency.setdefault(row["TargetNodeID"], []).append((row["SourceNodeID"], row))

        queue = [source_author_id]
        parents: dict[int, tuple[int | None, sqlite3.Row | None]] = {source_author_id: (None, None)}
        while queue:
            current = queue.pop(0)
            if current == target_author_id:
                break
            for neighbor, edge in adjacency.get(current, []):
                if neighbor not in parents:
                    parents[neighbor] = (current, edge)
                    queue.append(neighbor)

        if target_author_id not in parents:
            return None

        node_ids = []
        path_edges = []
        current = target_author_id
        while current is not None:
            node_ids.append(current)
            parent, edge = parents[current]
            if edge is not None:
                path_edges.append(edge)
            current = parent
        node_ids.reverse()
        path_edges.reverse()

        placeholders = ", ".join("?" for _ in node_ids)
        node_rows = connection.execute(
            f"SELECT NodeID, NodeType, DisplayLabel FROM Nodes WHERE NodeID IN ({placeholders}) ORDER BY DisplayLabel",
            tuple(node_ids),
        ).fetchall()
        labels = {row["NodeID"]: row["DisplayLabel"] for row in node_rows}
        return {
            "pathAuthorIds": node_ids,
            "pathAuthorNames": [labels[node_id] for node_id in node_ids],
            "hopCount": max(len(node_ids) - 1, 0),
            "nodes": [row_to_graph_node(row, isFocus=row["NodeID"] in {source_author_id, target_author_id}) for row in node_rows],
            "edges": [row_to_graph_edge(row) for row in path_edges],
        }
    finally:
        connection.close()


def get_influential_authors(limit: int = 10, year_from: int | None = None, q1_only: bool = False) -> list[dict]:
    grouped: dict[int, dict] = {}
    for row in load_author_publication_metrics():
        if year_from is not None and row["PublicationYear"] < year_from:
            continue
        if q1_only and row["Quartile"] != "Q1":
            continue

        author = grouped.setdefault(
            row["authorId"],
            {
                "authorId": row["authorId"],
                "authorName": row["authorName"],
                "citationCount": 0,
                "publicationCount": 0,
                "venues": set(),
                "citationSeries": [],
            },
        )
        author["citationCount"] += row["citationCount"]
        author["publicationCount"] += 1
        author["venues"].add(row["venueName"])
        author["citationSeries"].append(row["citationCount"])

    ranked = []
    for author in grouped.values():
        ranked.append(
            {
                "authorId": author["authorId"],
                "authorName": author["authorName"],
                "citationCount": author["citationCount"],
                "publicationCount": author["publicationCount"],
                "hIndex": compute_h_index(author["citationSeries"]),
                "citationScore": round(author["citationCount"] / max(author["publicationCount"], 1), 2),
                "venues": sorted(author["venues"]),
            }
        )

    return sorted(
        ranked,
        key=lambda author: (-author["citationCount"], -author["hIndex"], author["authorName"]),
    )[:limit]


def get_institution_collaboration_ranking() -> list[dict]:
    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT
              p.NodeID AS publicationId,
              p.Title AS title,
              a.NodeID AS authorId,
              i.NodeID AS institutionId,
              i.Name AS institutionName
            FROM Publications p
            JOIN Edges authored
              ON authored.TargetNodeID = p.NodeID
             AND authored.EdgeType = 'AUTHORED'
            JOIN Authors a
              ON a.NodeID = authored.SourceNodeID
            JOIN Edges affiliation
              ON affiliation.SourceNodeID = a.NodeID
             AND affiliation.EdgeType = 'AFFILIATED_WITH'
            JOIN Institutions i
              ON i.NodeID = affiliation.TargetNodeID
            ORDER BY p.NodeID, i.Name
            """
        ).fetchall()

        publication_map: dict[int, dict] = {}
        for row in rows:
            publication = publication_map.setdefault(row["publicationId"], {"title": row["title"], "institutions": {}})
            publication["institutions"][row["institutionId"]] = row["institutionName"]

        ranking: dict[tuple[int, int], dict] = {}
        for publication in publication_map.values():
            institution_items = sorted(publication["institutions"].items())
            for index, (left_id, left_name) in enumerate(institution_items):
                for right_id, right_name in institution_items[index + 1:]:
                    key = (left_id, right_id)
                    pair = ranking.get(
                        key,
                        {
                            "leftInstitutionId": left_id,
                            "leftInstitutionName": left_name,
                            "rightInstitutionId": right_id,
                            "rightInstitutionName": right_name,
                            "sharedPublications": 0,
                            "sampleTitles": [],
                        },
                    )
                    pair["sharedPublications"] += 1
                    pair["sampleTitles"].append(publication["title"])
                    ranking[key] = pair

        return sorted(ranking.values(), key=lambda pair: (-pair["sharedPublications"], pair["leftInstitutionName"], pair["rightInstitutionName"]))
    finally:
        connection.close()


def create_institution(payload: dict) -> dict:
    connection = get_connection()
    try:
        name = normalize_text(payload.get("name"), "Institution name")
        country = normalize_text(payload.get("country"), "Country")
        duplicate = connection.execute("SELECT 1 FROM Institutions WHERE lower(Name) = lower(?)", (name,)).fetchone()
        if duplicate:
            raise ValueError("An institution with that name already exists.")

        node_id = get_next_id(connection, "Nodes", "NodeID")
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (node_id, "Institution", name, serialize_node_attributes("Institution", {"name": name, "country": country})),
        )
        connection.execute("INSERT INTO Institutions (NodeID, Name, Country) VALUES (?, ?, ?)", (node_id, name, country))
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(node_id)
    finally:
        connection.close()


def update_institution(institution_id: int, payload: dict) -> dict:
    connection = get_connection()
    try:
        require_node(connection, institution_id, "Institution")
        name = normalize_text(payload.get("name"), "Institution name")
        country = normalize_text(payload.get("country"), "Country")
        duplicate = connection.execute(
            "SELECT 1 FROM Institutions WHERE lower(Name) = lower(?) AND NodeID != ?",
            (name, institution_id),
        ).fetchone()
        if duplicate:
            raise ValueError("An institution with that name already exists.")

        connection.execute("UPDATE Institutions SET Name = ?, Country = ? WHERE NodeID = ?", (name, country, institution_id))
        set_node_record(connection, institution_id, "Institution", name, {"name": name, "country": country})
        connection.commit()
        return get_node_details(institution_id)
    finally:
        connection.close()


def delete_institution(institution_id: int) -> None:
    connection = get_connection()
    try:
        require_node(connection, institution_id, "Institution")
        linked_authors = connection.execute(
            "SELECT COUNT(*) AS total FROM Edges WHERE EdgeType = 'AFFILIATED_WITH' AND TargetNodeID = ?",
            (institution_id,),
        ).fetchone()
        if linked_authors["total"] > 0:
            raise ValueError("Reassign or remove affiliated authors before deleting this institution.")

        connection.execute("DELETE FROM Nodes WHERE NodeID = ?", (institution_id,))
        rebuild_graph_memberships(connection)
        connection.commit()
    finally:
        connection.close()


def create_author(payload: dict) -> dict:
    connection = get_connection()
    try:
        full_name = normalize_text(payload.get("fullName"), "Author name")
        research_area = normalize_text(payload.get("researchArea"), "Research area")
        email = validate_email(payload.get("email", ""))
        institution_id = normalize_integer(payload.get("institutionId"), "Institution", minimum=1)
        start_year = normalize_integer(payload.get("affiliationStartYear") or 2020, "Affiliation start year", minimum=1900)
        role = normalize_text(payload.get("affiliationRole") or "Faculty", "Affiliation role")

        require_node(connection, institution_id, "Institution")
        duplicate = connection.execute("SELECT 1 FROM Authors WHERE lower(Email) = lower(?)", (email,)).fetchone()
        if duplicate:
            raise ValueError("An author with that email already exists.")

        node_id = get_next_id(connection, "Nodes", "NodeID")
        author_record = {
            "fullName": full_name,
            "researchArea": research_area,
            "email": email,
            "institutionId": institution_id,
        }
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (node_id, "Author", full_name, serialize_node_attributes("Author", author_record)),
        )
        connection.execute(
            "INSERT INTO Authors (NodeID, FullName, ResearchArea, Email) VALUES (?, ?, ?, ?)",
            (node_id, full_name, research_area, email),
        )
        insert_edge(
            connection,
            node_id,
            institution_id,
            "AFFILIATED_WITH",
            start_year,
            1,
            {"role": role, "startYear": start_year, "endYear": None},
        )
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(node_id)
    finally:
        connection.close()


def update_author(author_id: int, payload: dict) -> dict:
    connection = get_connection()
    try:
        require_node(connection, author_id, "Author")
        full_name = normalize_text(payload.get("fullName"), "Author name")
        research_area = normalize_text(payload.get("researchArea"), "Research area")
        email = validate_email(payload.get("email", ""))
        institution_id = normalize_integer(payload.get("institutionId"), "Institution", minimum=1)
        start_year = normalize_integer(payload.get("affiliationStartYear") or 2020, "Affiliation start year", minimum=1900)
        role = normalize_text(payload.get("affiliationRole") or "Faculty", "Affiliation role")

        require_node(connection, institution_id, "Institution")
        duplicate = connection.execute(
            "SELECT 1 FROM Authors WHERE lower(Email) = lower(?) AND NodeID != ?",
            (email, author_id),
        ).fetchone()
        if duplicate:
            raise ValueError("An author with that email already exists.")

        connection.execute(
            "UPDATE Authors SET FullName = ?, ResearchArea = ?, Email = ? WHERE NodeID = ?",
            (full_name, research_area, email, author_id),
        )
        set_node_record(
            connection,
            author_id,
            "Author",
            full_name,
            {"fullName": full_name, "researchArea": research_area, "email": email, "institutionId": institution_id},
        )
        connection.execute("DELETE FROM Edges WHERE EdgeType = 'AFFILIATED_WITH' AND SourceNodeID = ?", (author_id,))
        insert_edge(
            connection,
            author_id,
            institution_id,
            "AFFILIATED_WITH",
            start_year,
            1,
            {"role": role, "startYear": start_year, "endYear": None},
        )
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(author_id)
    finally:
        connection.close()


def delete_author(author_id: int) -> None:
    connection = get_connection()
    try:
        require_node(connection, author_id, "Author")
        orphaned_publication = connection.execute(
            """
            SELECT p.Title
            FROM Publications p
            JOIN Edges authored
              ON authored.TargetNodeID = p.NodeID
             AND authored.EdgeType = 'AUTHORED'
            WHERE authored.SourceNodeID = ?
              AND (
                SELECT COUNT(*)
                FROM Edges authored2
                WHERE authored2.EdgeType = 'AUTHORED'
                  AND authored2.TargetNodeID = p.NodeID
              ) = 1
            LIMIT 1
            """,
            (author_id,),
        ).fetchone()
        if orphaned_publication is not None:
            raise ValueError(f"Cannot delete this author because they are the sole author of '{orphaned_publication['Title']}'.")

        connection.execute("DELETE FROM Nodes WHERE NodeID = ?", (author_id,))
        rebuild_coauthor_edges(connection)
        rebuild_graph_memberships(connection)
        connection.commit()
    finally:
        connection.close()


def create_venue(payload: dict) -> dict:
    connection = get_connection()
    try:
        name = normalize_text(payload.get("name"), "Venue name")
        kind = normalize_venue_kind(payload.get("kind"))
        quartile = normalize_quartile(payload.get("quartile"))
        impact_score = normalize_float(payload.get("impactScore"), "Impact score", minimum=0)
        duplicate = connection.execute("SELECT 1 FROM Venues WHERE lower(Name) = lower(?)", (name,)).fetchone()
        if duplicate:
            raise ValueError("A venue with that name already exists.")

        node_id = get_next_id(connection, "Nodes", "NodeID")
        venue_record = {"name": name, "kind": kind, "quartile": quartile, "impactScore": impact_score}
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (node_id, "Venue", name, serialize_node_attributes("Venue", venue_record)),
        )
        connection.execute(
            "INSERT INTO Venues (NodeID, Name, VenueKind, Quartile, ImpactScore) VALUES (?, ?, ?, ?, ?)",
            (node_id, name, kind, quartile, impact_score),
        )
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(node_id)
    finally:
        connection.close()


def update_venue(venue_id: int, payload: dict) -> dict:
    connection = get_connection()
    try:
        require_node(connection, venue_id, "Venue")
        name = normalize_text(payload.get("name"), "Venue name")
        kind = normalize_venue_kind(payload.get("kind"))
        quartile = normalize_quartile(payload.get("quartile"))
        impact_score = normalize_float(payload.get("impactScore"), "Impact score", minimum=0)
        duplicate = connection.execute(
            "SELECT 1 FROM Venues WHERE lower(Name) = lower(?) AND NodeID != ?",
            (name, venue_id),
        ).fetchone()
        if duplicate:
            raise ValueError("A venue with that name already exists.")

        connection.execute(
            "UPDATE Venues SET Name = ?, VenueKind = ?, Quartile = ?, ImpactScore = ? WHERE NodeID = ?",
            (name, kind, quartile, impact_score, venue_id),
        )
        set_node_record(
            connection,
            venue_id,
            "Venue",
            name,
            {"name": name, "kind": kind, "quartile": quartile, "impactScore": impact_score},
        )
        connection.commit()
        return get_node_details(venue_id)
    finally:
        connection.close()


def delete_venue(venue_id: int) -> None:
    connection = get_connection()
    try:
        require_node(connection, venue_id, "Venue")
        linked_publications = connection.execute(
            "SELECT COUNT(*) AS total FROM Edges WHERE EdgeType = 'PUBLISHED_IN' AND TargetNodeID = ?",
            (venue_id,),
        ).fetchone()
        if linked_publications["total"] > 0:
            raise ValueError("Reassign linked publications before deleting this venue.")

        connection.execute("DELETE FROM Nodes WHERE NodeID = ?", (venue_id,))
        rebuild_graph_memberships(connection)
        connection.commit()
    finally:
        connection.close()


def create_publication(payload: dict) -> dict:
    connection = get_connection()
    try:
        title = normalize_text(payload.get("title"), "Publication title")
        year = normalize_integer(payload.get("year"), "Publication year", minimum=1900)
        doi = normalize_text(payload.get("doi"), "DOI")
        venue_id = normalize_integer(payload.get("venueId"), "Venue", minimum=1)
        author_ids = normalize_id_list(payload.get("authorIds", []), "Author list")
        citation_target_ids = normalize_id_list(payload.get("citationTargetIds", []), "Citation list")

        if not author_ids:
            raise ValueError("Select at least one author.")
        require_node(connection, venue_id, "Venue")
        for author_id in author_ids:
            require_node(connection, author_id, "Author")
        for target_id in citation_target_ids:
            require_node(connection, target_id, "Publication")

        duplicate = connection.execute("SELECT 1 FROM Publications WHERE lower(DOI) = lower(?)", (doi,)).fetchone()
        if duplicate:
            raise ValueError("A publication with that DOI already exists.")

        node_id = get_next_id(connection, "Nodes", "NodeID")
        publication_record = {"title": title, "year": year, "doi": doi, "venueId": venue_id, "authorIds": author_ids}
        connection.execute(
            "INSERT INTO Nodes (NodeID, NodeType, DisplayLabel, AttributesJson) VALUES (?, ?, ?, ?)",
            (node_id, "Publication", title, serialize_node_attributes("Publication", publication_record)),
        )
        connection.execute(
            "INSERT INTO Publications (NodeID, Title, PublicationYear, DOI) VALUES (?, ?, ?, ?)",
            (node_id, title, year, doi),
        )
        for index, author_id in enumerate(author_ids, start=1):
            insert_edge(
                connection,
                author_id,
                node_id,
                "AUTHORED",
                year,
                1,
                {"contribution": "co-author", "authorOrder": index, "isLeadAuthor": index == 1},
            )
        insert_edge(
            connection,
            node_id,
            venue_id,
            "PUBLISHED_IN",
            year,
            1,
            {"venueYear": year, "peerReviewed": True},
        )
        for target_id in citation_target_ids:
            insert_edge(
                connection,
                node_id,
                target_id,
                "CITES",
                year,
                1,
                {"relation": "citation", "context": "Background or supporting work"},
            )
        rebuild_coauthor_edges(connection)
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(node_id)
    finally:
        connection.close()


def update_publication(publication_id: int, payload: dict) -> dict:
    connection = get_connection()
    try:
        require_node(connection, publication_id, "Publication")
        title = normalize_text(payload.get("title"), "Publication title")
        year = normalize_integer(payload.get("year"), "Publication year", minimum=1900)
        doi = normalize_text(payload.get("doi"), "DOI")
        venue_id = normalize_integer(payload.get("venueId"), "Venue", minimum=1)
        author_ids = normalize_id_list(payload.get("authorIds", []), "Author list")
        citation_target_ids = normalize_id_list(payload.get("citationTargetIds", []), "Citation list")

        if not author_ids:
            raise ValueError("Select at least one author.")
        require_node(connection, venue_id, "Venue")
        for author_id in author_ids:
            require_node(connection, author_id, "Author")
        for target_id in citation_target_ids:
            require_node(connection, target_id, "Publication")

        duplicate = connection.execute(
            "SELECT 1 FROM Publications WHERE lower(DOI) = lower(?) AND NodeID != ?",
            (doi, publication_id),
        ).fetchone()
        if duplicate:
            raise ValueError("A publication with that DOI already exists.")

        connection.execute(
            "UPDATE Publications SET Title = ?, PublicationYear = ?, DOI = ? WHERE NodeID = ?",
            (title, year, doi, publication_id),
        )
        set_node_record(
            connection,
            publication_id,
            "Publication",
            title,
            {"title": title, "year": year, "doi": doi, "venueId": venue_id, "authorIds": author_ids},
        )
        connection.execute(
            """
            DELETE FROM Edges
            WHERE SourceNodeID = ?
              AND EdgeType IN ('PUBLISHED_IN', 'CITES')
            """,
            (publication_id,),
        )
        connection.execute(
            """
            DELETE FROM Edges
            WHERE TargetNodeID = ?
              AND EdgeType = 'AUTHORED'
            """,
            (publication_id,),
        )
        for index, author_id in enumerate(author_ids, start=1):
            insert_edge(
                connection,
                author_id,
                publication_id,
                "AUTHORED",
                year,
                1,
                {"contribution": "co-author", "authorOrder": index, "isLeadAuthor": index == 1},
            )
        insert_edge(
            connection,
            publication_id,
            venue_id,
            "PUBLISHED_IN",
            year,
            1,
            {"venueYear": year, "peerReviewed": True},
        )
        for target_id in citation_target_ids:
            insert_edge(
                connection,
                publication_id,
                target_id,
                "CITES",
                year,
                1,
                {"relation": "citation", "context": "Background or supporting work"},
            )
        rebuild_coauthor_edges(connection)
        rebuild_graph_memberships(connection)
        connection.commit()
        return get_node_details(publication_id)
    finally:
        connection.close()


def delete_publication(publication_id: int) -> None:
    connection = get_connection()
    try:
        require_node(connection, publication_id, "Publication")
        connection.execute("DELETE FROM Nodes WHERE NodeID = ?", (publication_id,))
        rebuild_coauthor_edges(connection)
        rebuild_graph_memberships(connection)
        connection.commit()
    finally:
        connection.close()
