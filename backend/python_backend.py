from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DB_PATH = Path(os.environ.get("GRAPH_DB_PATH", PROJECT_DIR / "data" / "academic_graph.db"))
SCHEMA_PATH = PROJECT_DIR / "database" / "schema.sql"

GRAPHS = [
    {"id": 1, "name": "Collaboration Graph", "description": "Authors, institutions, and collaboration relationships for network analysis."},
    {"id": 2, "name": "Citation Graph", "description": "Publication citation structure used for influence metrics such as h-index."},
    {"id": 3, "name": "Venue Influence Graph", "description": "Author-publication-venue paths enriched with journal quartile metadata."},
]

INSTITUTIONS = [
    {"id": 101, "name": "Rocky Mountain University", "country": "USA"},
    {"id": 102, "name": "Pacific Tech", "country": "USA"},
    {"id": 103, "name": "Lakeside Research Institute", "country": "Canada"},
    {"id": 104, "name": "Global Science Lab", "country": "UK"},
]

AUTHORS = [
    {"id": 1, "fullName": "Alice Carter", "researchArea": "Scholarly Graph Analytics", "email": "alice.carter@rmu.edu", "institutionId": 101},
    {"id": 2, "fullName": "Ben Ortiz", "researchArea": "Digital Libraries", "email": "ben.ortiz@rmu.edu", "institutionId": 101},
    {"id": 3, "fullName": "Chloe Zhang", "researchArea": "Citation Networks", "email": "chloe.zhang@pacifictech.edu", "institutionId": 102},
    {"id": 4, "fullName": "Daniel Kim", "researchArea": "Metadata Systems", "email": "daniel.kim@pacifictech.edu", "institutionId": 102},
    {"id": 5, "fullName": "Emma Patel", "researchArea": "Scholarly Repositories", "email": "emma.patel@lri.ca", "institutionId": 103},
    {"id": 6, "fullName": "Farah Nasser", "researchArea": "Research Impact Modeling", "email": "farah.nasser@lri.ca", "institutionId": 103},
    {"id": 7, "fullName": "Grace Liu", "researchArea": "Human-Centered Discovery", "email": "grace.liu@gsl.ac.uk", "institutionId": 104},
    {"id": 8, "fullName": "Henry Brooks", "researchArea": "Science Mapping", "email": "henry.brooks@gsl.ac.uk", "institutionId": 104},
]

VENUES = [
    {"id": 201, "name": "Journal of Graph Analytics", "kind": "Journal", "quartile": "Q1", "impactScore": 9.4},
    {"id": 202, "name": "Data Systems Review", "kind": "Journal", "quartile": "Q2", "impactScore": 6.8},
    {"id": 203, "name": "Network Science Letters", "kind": "Journal", "quartile": "Q1", "impactScore": 8.9},
    {"id": 204, "name": "Library Informatics Conference", "kind": "Conference", "quartile": None, "impactScore": 5.3},
    {"id": 205, "name": "Scholarly Data Mining Journal", "kind": "Journal", "quartile": "Q1", "impactScore": 9.1},
    {"id": 206, "name": "Regional Library Technology Review", "kind": "Journal", "quartile": "Q3", "impactScore": 4.7},
]

PUBLICATIONS = [
    {"id": 301, "title": "Graph Models for Digital Libraries", "year": 2020, "doi": "10.1000/alms.301", "venueId": 201, "authorIds": [1, 2]},
    {"id": 302, "title": "Citation Flows in Academic Archives", "year": 2021, "doi": "10.1000/alms.302", "venueId": 203, "authorIds": [1, 3]},
    {"id": 303, "title": "Metadata-Driven Discovery Systems", "year": 2021, "doi": "10.1000/alms.303", "venueId": 202, "authorIds": [1, 4]},
    {"id": 304, "title": "Institutional Collaboration Graphs", "year": 2022, "doi": "10.1000/alms.304", "venueId": 205, "authorIds": [1, 5]},
    {"id": 305, "title": "Temporal Citation Networks", "year": 2022, "doi": "10.1000/alms.305", "venueId": 201, "authorIds": [1, 6]},
    {"id": 306, "title": "Knowledge Graph Interfaces for Librarians", "year": 2023, "doi": "10.1000/alms.306", "venueId": 204, "authorIds": [2, 7]},
    {"id": 307, "title": "Research Data Stewardship at Scale", "year": 2020, "doi": "10.1000/alms.307", "venueId": 202, "authorIds": [3, 4]},
    {"id": 308, "title": "Ranking Scholarly Venues with Graph Signals", "year": 2023, "doi": "10.1000/alms.308", "venueId": 205, "authorIds": [3, 5]},
    {"id": 309, "title": "Q1-Aware Recommendation Paths", "year": 2024, "doi": "10.1000/alms.309", "venueId": 201, "authorIds": [3, 6]},
    {"id": 310, "title": "Journal Influence Mapping", "year": 2021, "doi": "10.1000/alms.310", "venueId": 203, "authorIds": [3, 8]},
    {"id": 311, "title": "Library AI Collaboration Atlas", "year": 2022, "doi": "10.1000/alms.311", "venueId": 204, "authorIds": [5, 7]},
    {"id": 312, "title": "Repository Search Optimization", "year": 2024, "doi": "10.1000/alms.312", "venueId": 206, "authorIds": [2, 4]},
    {"id": 313, "title": "Cross-Institutional Scholar Graphs", "year": 2023, "doi": "10.1000/alms.313", "venueId": 205, "authorIds": [5, 6]},
    {"id": 314, "title": "Author Disambiguation in Repositories", "year": 2022, "doi": "10.1000/alms.314", "venueId": 201, "authorIds": [1, 3, 5]},
    {"id": 315, "title": "Venue Signals for Academic Discovery", "year": 2024, "doi": "10.1000/alms.315", "venueId": 203, "authorIds": [1, 3]},
]

CITATION_PAIRS = [
    (306, 301), (307, 301), (308, 301), (309, 301), (310, 301),
    (301, 302), (304, 302), (305, 302), (308, 302), (313, 302), (315, 302),
    (301, 303), (302, 303), (307, 303), (310, 303), (314, 303),
    (302, 304), (305, 304), (309, 304), (311, 304), (315, 304),
    (301, 305), (303, 305), (308, 305), (310, 305), (312, 305),
    (301, 307), (304, 307), (306, 307), (309, 307), (313, 307),
    (302, 308), (305, 308), (310, 308), (314, 308), (315, 308),
    (301, 309), (307, 309), (311, 309), (314, 309), (315, 309),
    (303, 310), (305, 310), (308, 310), (312, 310), (314, 310),
    (302, 314), (304, 314), (306, 314), (309, 314), (311, 314),
    (303, 315), (305, 315), (308, 315), (310, 315), (313, 315),
]


def get_db_path() -> Path:
    return DB_PATH


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


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
        connection.execute("INSERT INTO Nodes (NodeID, NodeType, DisplayLabel) VALUES (?, ?, ?)", (institution["id"], "Institution", institution["name"]))
        connection.execute("INSERT INTO Institutions (NodeID, Name, Country) VALUES (?, ?, ?)", (institution["id"], institution["name"], institution["country"]))

    for author in AUTHORS:
        connection.execute("INSERT INTO Nodes (NodeID, NodeType, DisplayLabel) VALUES (?, ?, ?)", (author["id"], "Author", author["fullName"]))
        connection.execute(
            "INSERT INTO Authors (NodeID, FullName, ResearchArea, Email) VALUES (?, ?, ?, ?)",
            (author["id"], author["fullName"], author["researchArea"], author["email"]),
        )

    for venue in VENUES:
        connection.execute("INSERT INTO Nodes (NodeID, NodeType, DisplayLabel) VALUES (?, ?, ?)", (venue["id"], "Venue", venue["name"]))
        connection.execute(
            "INSERT INTO Venues (NodeID, Name, VenueKind, Quartile, ImpactScore) VALUES (?, ?, ?, ?, ?)",
            (venue["id"], venue["name"], venue["kind"], venue["quartile"], venue["impactScore"]),
        )

    for publication in PUBLICATIONS:
        connection.execute("INSERT INTO Nodes (NodeID, NodeType, DisplayLabel) VALUES (?, ?, ?)", (publication["id"], "Publication", publication["title"]))
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
            (edge_id, author["id"], author["institutionId"], "AFFILIATED_WITH", None, 1, json.dumps({"role": "faculty"})),
        )
        edge_id += 1

    for publication in PUBLICATIONS:
        for author_id in publication["authorIds"]:
            connection.execute(
                """
                INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (edge_id, author_id, publication["id"], "AUTHORED", publication["year"], 1, json.dumps({"contribution": "co-author"})),
            )
            edge_id += 1

        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (edge_id, publication["id"], publication["venueId"], "PUBLISHED_IN", publication["year"], 1, json.dumps({"venueYear": publication["year"]})),
        )
        edge_id += 1

    for pair in build_coauthor_pairs():
        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (edge_id, pair["source"], pair["target"], "CO_AUTHOR", pair["latestYear"], pair["sharedCount"], json.dumps({"sharedPublications": pair["sharedCount"]})),
        )
        edge_id += 1

    publication_years = {publication["id"]: publication["year"] for publication in PUBLICATIONS}
    for source, target in CITATION_PAIRS:
        connection.execute(
            """
            INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (edge_id, source, target, "CITES", publication_years[source], 1, json.dumps({"relation": "citation"})),
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
        if force:
            seed_database(connection)
            return

        row = connection.execute("SELECT COUNT(*) AS count FROM Nodes").fetchone()
        if row["count"] == 0:
            seed_database(connection)
    finally:
        connection.close()


def row_to_graph_node(row: sqlite3.Row, **extra: object) -> dict:
    return {"id": row["NodeID"], "label": row["DisplayLabel"], "type": row["NodeType"], **extra}


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


def list_authors() -> list[dict]:
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
            ORDER BY a.FullName
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def get_coauthor_network(author_id: object) -> dict | None:
    connection = get_connection()
    try:
        normalized_author_id = int(author_id)
        author = connection.execute(
            "SELECT NodeID, FullName, ResearchArea FROM Authors WHERE NodeID = ?",
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
            """,
            (normalized_author_id, normalized_author_id),
        ).fetchall()

        node_ids = {normalized_author_id}
        for row in coauthor_rows:
            node_ids.add(row["SourceNodeID"])
            node_ids.add(row["TargetNodeID"])

        placeholders = ", ".join("?" for _ in node_ids)
        params = tuple(node_ids)
        node_rows = connection.execute(
            f"""
            SELECT NodeID, NodeType, DisplayLabel
            FROM Nodes
            WHERE NodeID IN ({placeholders})
            ORDER BY DisplayLabel
            """,
            params,
        ).fetchall()

        edge_rows = connection.execute(
            f"""
            SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
            FROM Edges
            WHERE EdgeType = 'CO_AUTHOR'
              AND SourceNodeID IN ({placeholders})
              AND TargetNodeID IN ({placeholders})
            ORDER BY Weight DESC, EdgeID
            """,
            (*params, *params),
        ).fetchall()

        return {
            "author": dict(author),
            "nodes": [row_to_graph_node(row, isFocus=row["NodeID"] == normalized_author_id) for row in node_rows],
            "edges": [row_to_graph_edge(row) for row in edge_rows],
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
