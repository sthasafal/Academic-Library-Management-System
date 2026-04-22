import test from "node:test";
import assert from "node:assert/strict";
import { ensureDatabase } from "../database/init.js";
import { getCoAuthorNetwork, getQ1InfluenceNetwork, listAuthorsByHIndex, listCollections } from "../backend/graphService.js";

test("h-index query returns authors at or above threshold", () => {
  ensureDatabase({ force: true });
  const authors = listAuthorsByHIndex(5);
  const names = authors.map((author) => author.authorName);

  assert.deepEqual(names, ["Alice Carter", "Chloe Zhang"]);
  assert.equal(authors[0].hIndex, 5);
  assert.equal(authors[1].hIndex, 5);
});

test("co-author query returns focused one-hop network", () => {
  ensureDatabase({ force: true });
  const network = getCoAuthorNetwork(1);
  const labels = network.nodes.map((node) => node.label).sort();

  assert.equal(network.author.FullName, "Alice Carter");
  assert.equal(network.nodes.filter((node) => node.isFocus).length, 1);
  assert.equal(network.nodes.find((node) => node.isFocus).label, "Alice Carter");
  assert.equal(network.summary.directCoauthors, 5);
  assert.equal(network.summary.publicationCount, 7);
  assert.equal(network.summary.strongestCollaboration.authorName, "Chloe Zhang");
  assert.ok(network.collaborators.some((author) => author.authorName === "Chloe Zhang" && author.sharedPublications === 3));
  assert.ok(network.publications.some((publication) => publication.title === "Venue Signals for Academic Discovery"));
  assert.deepEqual(labels, ["Alice Carter", "Ben Ortiz", "Chloe Zhang", "Daniel Kim", "Emma Patel", "Farah Nasser"]);
  assert.ok(network.edges.some((edge) => edge.weight >= 2));
});

test("collections query returns publications and venues", () => {
  ensureDatabase({ force: true });
  const collections = listCollections();

  assert.equal(collections.publications.length, 15);
  assert.equal(collections.venues.length, 6);
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
