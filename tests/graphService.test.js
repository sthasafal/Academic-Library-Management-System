import test from "node:test";
import assert from "node:assert/strict";
import { ensureDatabase } from "../database/init.js";
import { getCoAuthorNetwork, getHIndexReport, getQ1InfluenceNetwork, listAuthorsByHIndex, listCollections, listGraphs } from "../backend/graphService.js";

test("h-index query returns authors at or above threshold", () => {
  ensureDatabase({ force: true });
  const authors = listAuthorsByHIndex(5);
  const names = authors.map((author) => author.authorName);

  assert.ok(names.includes("Alice Carter"));
  assert.ok(authors.every((author) => author.hIndex >= 5));
});

test("co-author query returns focused one-hop network", () => {
  ensureDatabase({ force: true });
  const network = getCoAuthorNetwork(1);
  const labels = network.nodes.map((node) => node.label).sort();

  assert.equal(network.author.FullName, "Alice Carter");
  assert.equal(network.nodes.filter((node) => node.isFocus).length, 1);
  assert.equal(network.nodes.find((node) => node.isFocus).label, "Alice Carter");
  assert.ok(network.summary.directCoauthors >= 7);
  assert.ok(network.summary.publicationCount >= 9);
  assert.equal(network.summary.strongestCollaboration.authorName, "Chloe Zhang");
  assert.ok(network.collaborators.some((author) => author.authorName === "Chloe Zhang" && author.sharedPublications === 3));
  assert.ok(network.publications.some((publication) => publication.title === "Venue Signals for Academic Discovery"));
  assert.ok(labels.includes("Alice Carter"));
  assert.ok(labels.includes("Chloe Zhang"));
  assert.ok(labels.includes("Ivy Nguyen"));
  assert.ok(network.edges.some((edge) => edge.weight >= 2));
});

test("collections query returns publications and venues", () => {
  ensureDatabase({ force: true });
  const collections = listCollections();

  assert.equal(collections.publications.length, 32);
  assert.equal(collections.venues.length, 10);
  assert.ok(collections.publications.some((publication) => publication.title === "Graph Models for Digital Libraries"));
  assert.ok(collections.venues.some((venue) => venue.name === "Journal of Graph Analytics" && venue.publicationCount > 0));
});

test("Q1 influence query returns qualifying authors and network", () => {
  ensureDatabase({ force: true });
  const result = getQ1InfluenceNetwork();
  const qualifyingNames = result.qualifyingAuthors.map((author) => author.authorName);

  assert.ok(qualifyingNames.includes("Ben Ortiz"));
  assert.ok(qualifyingNames.includes("Daniel Kim"));
  assert.ok(qualifyingNames.includes("Grace Liu"));
  assert.ok(result.nodes.some((node) => node.isQ1Publisher));
});

test("graph catalog exposes multi-graph membership counts", () => {
  ensureDatabase({ force: true });
  const graphs = listGraphs();

  assert.equal(graphs.length, 3);
  assert.equal(graphs[0].GraphName, "Collaboration Graph");
  assert.ok(graphs.every((graph) => graph.nodeCount > 0));
  assert.ok(graphs.every((graph) => graph.edgeCount > 0));
});

test("h-index report includes an explicit schema-based definition", () => {
  ensureDatabase({ force: true });
  const result = getHIndexReport(5);

  assert.equal(result.minimum, 5);
  assert.match(result.definition, /incoming CITES edges/);
  assert.ok(result.authors.length >= 1);
  assert.ok(result.authors.some((author) => author.authorName === "Alice Carter"));
  assert.ok(result.authors.every((author) => author.hIndex >= 5));
});

test("nodes store type-specific attributes as JSON", () => {
  const db = ensureDatabase({ force: true });
  const row = db.prepare(`
    SELECT NodeType, DisplayLabel, AttributesJson
    FROM Nodes
    WHERE NodeID = 1
  `).get();
  const payload = JSON.parse(row.AttributesJson);

  assert.equal(row.NodeType, "Author");
  assert.equal(row.DisplayLabel, "Alice Carter");
  assert.equal(payload.fullName, "Alice Carter");
  assert.equal(payload.institutionId, 101);
});
