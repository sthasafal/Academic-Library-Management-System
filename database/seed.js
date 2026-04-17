import { authors, citationPairs, graphs, institutions, publications, venues } from "./seedData.js";

function insertNodes(db) {
  const insertNode = db.prepare(`
    INSERT INTO Nodes (NodeID, NodeType, DisplayLabel)
    VALUES (@id, @type, @label)
  `);

  const insertAuthor = db.prepare(`
    INSERT INTO Authors (NodeID, FullName, ResearchArea, Email)
    VALUES (@id, @fullName, @researchArea, @email)
  `);

  const insertInstitution = db.prepare(`
    INSERT INTO Institutions (NodeID, Name, Country)
    VALUES (@id, @name, @country)
  `);

  const insertVenue = db.prepare(`
    INSERT INTO Venues (NodeID, Name, VenueKind, Quartile, ImpactScore)
    VALUES (@id, @name, @kind, @quartile, @impactScore)
  `);

  const insertPublication = db.prepare(`
    INSERT INTO Publications (NodeID, Title, PublicationYear, DOI)
    VALUES (@id, @title, @year, @doi)
  `);

  for (const institution of institutions) {
    insertNode.run({ id: institution.id, type: "Institution", label: institution.name });
    insertInstitution.run(institution);
  }

  for (const author of authors) {
    insertNode.run({ id: author.id, type: "Author", label: author.fullName });
    insertAuthor.run(author);
  }

  for (const venue of venues) {
    insertNode.run({ id: venue.id, type: "Venue", label: venue.name });
    insertVenue.run(venue);
  }

  for (const publication of publications) {
    insertNode.run({ id: publication.id, type: "Publication", label: publication.title });
    insertPublication.run(publication);
  }
}

function insertGraphs(db) {
  const insertGraph = db.prepare(`
    INSERT INTO Graphs (GraphID, GraphName, Description)
    VALUES (@id, @name, @description)
  `);

  for (const graph of graphs) {
    insertGraph.run(graph);
  }
}

function buildCoAuthorPairs() {
  const pairMap = new Map();

  for (const publication of publications) {
    for (let index = 0; index < publication.authorIds.length; index += 1) {
      for (let inner = index + 1; inner < publication.authorIds.length; inner += 1) {
        const source = Math.min(publication.authorIds[index], publication.authorIds[inner]);
        const target = Math.max(publication.authorIds[index], publication.authorIds[inner]);
        const key = `${source}-${target}`;
        const existing = pairMap.get(key) || { source, target, sharedCount: 0, latestYear: publication.year };
        existing.sharedCount += 1;
        existing.latestYear = Math.max(existing.latestYear, publication.year);
        pairMap.set(key, existing);
      }
    }
  }

  return [...pairMap.values()];
}

function insertEdges(db) {
  const insertEdge = db.prepare(`
    INSERT INTO Edges (EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)
    VALUES (@id, @source, @target, @type, @year, @weight, @metadata)
  `);

  let edgeId = 1;

  for (const author of authors) {
    insertEdge.run({
      id: edgeId,
      source: author.id,
      target: author.institutionId,
      type: "AFFILIATED_WITH",
      year: null,
      weight: 1,
      metadata: JSON.stringify({ role: "faculty" })
    });
    edgeId += 1;
  }

  for (const publication of publications) {
    for (const authorId of publication.authorIds) {
      insertEdge.run({
        id: edgeId,
        source: authorId,
        target: publication.id,
        type: "AUTHORED",
        year: publication.year,
        weight: 1,
        metadata: JSON.stringify({ contribution: "co-author" })
      });
      edgeId += 1;
    }

    insertEdge.run({
      id: edgeId,
      source: publication.id,
      target: publication.venueId,
      type: "PUBLISHED_IN",
      year: publication.year,
      weight: 1,
      metadata: JSON.stringify({ venueYear: publication.year })
    });
    edgeId += 1;
  }

  for (const pair of buildCoAuthorPairs()) {
    insertEdge.run({
      id: edgeId,
      source: pair.source,
      target: pair.target,
      type: "CO_AUTHOR",
      year: pair.latestYear,
      weight: pair.sharedCount,
      metadata: JSON.stringify({ sharedPublications: pair.sharedCount })
    });
    edgeId += 1;
  }

  for (const [source, target] of citationPairs) {
    const sourcePublication = publications.find((publication) => publication.id === source);

    insertEdge.run({
      id: edgeId,
      source,
      target,
      type: "CITES",
      year: sourcePublication.year,
      weight: 1,
      metadata: JSON.stringify({ relation: "citation" })
    });
    edgeId += 1;
  }
}

function insertGraphMembership(db) {
  const insertNodeGraph = db.prepare(`
    INSERT INTO NodeGraphs (GraphID, NodeID)
    VALUES (?, ?)
  `);

  const insertEdgeGraph = db.prepare(`
    INSERT INTO EdgeGraphs (GraphID, EdgeID)
    VALUES (?, ?)
  `);

  const authorIds = authors.map((author) => author.id);
  const institutionIds = institutions.map((institution) => institution.id);
  const publicationIds = publications.map((publication) => publication.id);
  const venueIds = venues.map((venue) => venue.id);

  for (const nodeId of [...authorIds, ...institutionIds, ...publicationIds]) {
    insertNodeGraph.run(1, nodeId);
  }

  for (const nodeId of publicationIds) {
    insertNodeGraph.run(2, nodeId);
  }

  for (const nodeId of [...authorIds, ...publicationIds, ...venueIds]) {
    insertNodeGraph.run(3, nodeId);
  }

  const edges = db.prepare(`
    SELECT EdgeID, EdgeType FROM Edges ORDER BY EdgeID
  `).all();

  for (const edge of edges) {
    if (["CO_AUTHOR", "AFFILIATED_WITH", "AUTHORED"].includes(edge.EdgeType)) {
      insertEdgeGraph.run(1, edge.EdgeID);
    }

    if (edge.EdgeType === "CITES") {
      insertEdgeGraph.run(2, edge.EdgeID);
    }

    if (["AUTHORED", "PUBLISHED_IN", "CO_AUTHOR"].includes(edge.EdgeType)) {
      insertEdgeGraph.run(3, edge.EdgeID);
    }
  }
}

export function seedDatabase(db) {
  const resetSql = `
    DELETE FROM EdgeGraphs;
    DELETE FROM NodeGraphs;
    DELETE FROM Edges;
    DELETE FROM Authors;
    DELETE FROM Institutions;
    DELETE FROM Publications;
    DELETE FROM Venues;
    DELETE FROM Nodes;
    DELETE FROM Graphs;
  `;

  db.exec(resetSql);
  insertGraphs(db);
  insertNodes(db);
  insertEdges(db);
  insertGraphMembership(db);
}
