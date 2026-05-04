from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_DIR))

TMP_DIR = tempfile.TemporaryDirectory()
os.environ["GRAPH_DB_PATH"] = str(Path(TMP_DIR.name) / "academic_graph_test.db")

import app as flask_app_module  # noqa: E402
from python_backend import ensure_database, get_db_path  # noqa: E402


class FlaskApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        flask_app_module.app.config["TESTING"] = True
        cls.client = flask_app_module.app.test_client()

    def setUp(self) -> None:
        ensure_database(force=True)

    def test_summary_endpoint_returns_seeded_counts(self) -> None:
        response = self.client.get("/api/summary")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(payload["authors"], 18)
        self.assertEqual(payload["publications"], 32)
        self.assertEqual(payload["venues"], 10)
        self.assertGreater(payload["relationships"], 0)

    def test_graphs_endpoint_exposes_multi_graph_membership(self) -> None:
        response = self.client.get("/api/graphs")
        self.assertEqual(response.status_code, 200)

        graphs = response.get_json()
        self.assertEqual(len(graphs), 3)
        self.assertEqual(graphs[0]["GraphName"], "Collaboration Graph")
        self.assertGreater(graphs[0]["nodeCount"], 0)
        self.assertGreater(graphs[0]["edgeCount"], 0)

    def test_h_index_endpoint_returns_definition_and_authors(self) -> None:
        response = self.client.get("/api/query/h-index?minimum=5")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(payload["minimum"], 5)
        self.assertIn("incoming CITES edges", payload["definition"])
        self.assertGreaterEqual(len(payload["authors"]), 1)
        self.assertTrue(any(author["authorName"] == "Alice Carter" for author in payload["authors"]))
        self.assertTrue(all(author["hIndex"] >= 5 for author in payload["authors"]))

    def test_q1_influence_endpoint_returns_definition_and_network(self) -> None:
        response = self.client.get("/api/query/q1-influence")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertIn("Quartile = 'Q1'", payload["definition"])
        self.assertTrue(any(author["authorName"] == "Ben Ortiz" for author in payload["qualifyingAuthors"]))
        self.assertTrue(any(node["isQ1Publisher"] for node in payload["nodes"]))

    def test_coauthor_endpoint_returns_visualizable_network(self) -> None:
        response = self.client.get("/api/query/coauthors?authorId=1")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(payload["author"]["FullName"], "Alice Carter")
        self.assertIn("One-hop co-author network", payload["definition"])
        self.assertGreaterEqual(payload["summary"]["directCoauthors"], 7)
        self.assertGreater(len(payload["nodes"]), 0)
        self.assertGreater(len(payload["edges"]), 0)

    def test_nodes_table_stores_type_specific_attributes_json(self) -> None:
        connection = sqlite3.connect(get_db_path())
        connection.row_factory = sqlite3.Row
        try:
            row = connection.execute(
                """
                SELECT NodeType, DisplayLabel, AttributesJson
                FROM Nodes
                WHERE NodeID = 1
                """
            ).fetchone()
        finally:
            connection.close()

        payload = json.loads(row["AttributesJson"])
        self.assertEqual(row["NodeType"], "Author")
        self.assertEqual(row["DisplayLabel"], "Alice Carter")
        self.assertEqual(payload["fullName"], "Alice Carter")
        self.assertEqual(payload["institutionId"], 101)

    def test_reference_data_endpoint_returns_lists_for_management_ui(self) -> None:
        response = self.client.get("/api/reference-data")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(len(payload["authors"]), 18)
        self.assertEqual(len(payload["institutions"]), 6)
        self.assertEqual(len(payload["venues"]), 10)
        self.assertEqual(len(payload["publications"]), 32)

    def test_search_endpoint_supports_combined_filters(self) -> None:
        response = self.client.get("/api/search?type=publications&q=Graph&yearFrom=2023&quartile=Q1")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertTrue(payload)
        self.assertTrue(all(item["publicationYear"] >= 2023 for item in payload))
        self.assertTrue(all(item["quartile"] == "Q1" for item in payload))

    def test_shortest_path_endpoint_returns_path_between_connected_authors(self) -> None:
        response = self.client.get("/api/query/shortest-path?sourceAuthorId=2&targetAuthorId=6")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertGreaterEqual(payload["hopCount"], 1)
        self.assertEqual(payload["pathAuthorNames"][0], "Ben Ortiz")
        self.assertEqual(payload["pathAuthorNames"][-1], "Farah Nasser")

    def test_influential_authors_endpoint_returns_ranked_results(self) -> None:
        response = self.client.get("/api/query/influential-authors?limit=5&q1Only=true")
        self.assertEqual(response.status_code, 200)

        payload = response.get_json()
        self.assertEqual(len(payload), 5)
        self.assertGreaterEqual(payload[0]["citationCount"], payload[-1]["citationCount"])

    def test_create_update_and_delete_institution_flow(self) -> None:
        create_response = self.client.post("/api/institutions", json={"name": "Archive Systems Institute", "country": "Germany"})
        self.assertEqual(create_response.status_code, 201)
        created = create_response.get_json()
        institution_id = created["id"]

        update_response = self.client.put(
            f"/api/institutions/{institution_id}",
            json={"name": "Archive Systems Institute", "country": "Denmark"},
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.get_json()
        self.assertEqual(updated["attributes"]["country"], "Denmark")

        delete_response = self.client.delete(f"/api/institutions/{institution_id}")
        self.assertEqual(delete_response.status_code, 200)

    def test_author_creation_rejects_invalid_email(self) -> None:
        response = self.client.post(
            "/api/authors",
            json={
                "fullName": "Test Author",
                "researchArea": "Testing",
                "email": "not-an-email",
                "institutionId": 101,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("valid email", response.get_json()["message"])

    def test_publication_creation_rejects_duplicate_doi(self) -> None:
        response = self.client.post(
            "/api/publications",
            json={
                "title": "Duplicate DOI Record",
                "year": 2025,
                "doi": "10.1000/alms.301",
                "venueId": 201,
                "authorIds": [1, 2],
                "citationTargetIds": [302],
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("DOI", response.get_json()["message"])


if __name__ == "__main__":
    unittest.main()
