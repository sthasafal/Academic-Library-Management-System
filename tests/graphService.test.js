import test from "node:test";
import assert from "node:assert/strict";
import { ensureDatabase } from "../database/init.js";
import { getCoAuthorNetwork, getQ1InfluenceNetwork, listAuthorsByHIndex } from "../backend/graphService.js";

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
  assert.deepEqual(labels, ["Alice Carter", "Ben Ortiz", "Chloe Zhang", "Daniel Kim", "Emma Patel", "Farah Nasser"]);
  assert.ok(network.edges.some((edge) => edge.weight >= 2));
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
