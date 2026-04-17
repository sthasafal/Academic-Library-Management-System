import { ensureDatabase } from "../database/init.js";

function listToPlaceholders(values) {
  return values.map(() => "?").join(", ");
}

function computeHIndex(citationCounts) {
  const sorted = [...citationCounts].sort((left, right) => right - left);
  let hIndex = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] >= index + 1) {
      hIndex = index + 1;
    } else {
      break;
    }
  }

  return hIndex;
}

function mapGraphNode(row, extra = {}) {
  return {
    id: row.NodeID,
    label: row.DisplayLabel,
    type: row.NodeType,
    ...extra
  };
}

function mapGraphEdge(row) {
  return {
    id: row.EdgeID,
    source: row.SourceNodeID,
    target: row.TargetNodeID,
    type: row.EdgeType,
    year: row.EdgeYear,
    weight: row.Weight
  };
}

export function getOverviewStats() {
  const db = ensureDatabase();
  const nodes = db.prepare(`
    SELECT NodeType, COUNT(*) AS total
    FROM Nodes
    GROUP BY NodeType
  `).all();

  const edges = db.prepare(`
    SELECT COUNT(*) AS total
    FROM Edges
  `).get();

  return {
    authors: nodes.find((row) => row.NodeType === "Author")?.total || 0,
    publications: nodes.find((row) => row.NodeType === "Publication")?.total || 0,
    venues: nodes.find((row) => row.NodeType === "Venue")?.total || 0,
    relationships: edges.total
  };
}

export function listAuthors() {
  const db = ensureDatabase();
  return db.prepare(`
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
  `).all();
}

export function getCoAuthorNetwork(authorId) {
  const db = ensureDatabase();
  const normalizedAuthorId = Number(authorId);
  const author = db.prepare(`
    SELECT a.NodeID, a.FullName, a.ResearchArea
    FROM Authors a
    WHERE a.NodeID = ?
  `).get(normalizedAuthorId);

  if (!author) {
    return null;
  }

  const coAuthorRows = db.prepare(`
    SELECT SourceNodeID, TargetNodeID
    FROM Edges
    WHERE EdgeType = 'CO_AUTHOR'
      AND (SourceNodeID = ? OR TargetNodeID = ?)
  `).all(normalizedAuthorId, normalizedAuthorId);

  const nodeIds = new Set([normalizedAuthorId]);
  for (const row of coAuthorRows) {
    nodeIds.add(row.SourceNodeID);
    nodeIds.add(row.TargetNodeID);
  }

  const nodeIdList = [...nodeIds];
  const placeholders = listToPlaceholders(nodeIdList);
  const nodes = db.prepare(`
    SELECT NodeID, NodeType, DisplayLabel
    FROM Nodes
    WHERE NodeID IN (${placeholders})
    ORDER BY DisplayLabel
  `).all(...nodeIdList).map((row) => mapGraphNode(row, { isFocus: row.NodeID === normalizedAuthorId }));

  const edges = db.prepare(`
    SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
    FROM Edges
    WHERE EdgeType = 'CO_AUTHOR'
      AND SourceNodeID IN (${placeholders})
      AND TargetNodeID IN (${placeholders})
    ORDER BY Weight DESC, EdgeID
  `).all(...nodeIdList, ...nodeIdList).map(mapGraphEdge);

  return {
    author,
    nodes,
    edges,
    definition: "One-hop co-author network centered on the selected author. Edge weight equals the number of shared publications."
  };
}

function loadAuthorPublicationMetrics() {
  const db = ensureDatabase();
  return db.prepare(`
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
  `).all();
}

export function listAuthorsByHIndex(minimum = 5) {
  const grouped = new Map();

  for (const row of loadAuthorPublicationMetrics()) {
    const existing = grouped.get(row.authorId) || {
      authorId: row.authorId,
      authorName: row.authorName,
      venues: new Set(),
      publications: []
    };

    existing.venues.add(row.venueName);
    existing.publications.push({
      publicationId: row.publicationId,
      title: row.publicationTitle,
      publicationYear: row.PublicationYear,
      venueName: row.venueName,
      quartile: row.Quartile,
      citationCount: row.citationCount
    });

    grouped.set(row.authorId, existing);
  }

  return [...grouped.values()]
    .map((author) => ({
      authorId: author.authorId,
      authorName: author.authorName,
      hIndex: computeHIndex(author.publications.map((publication) => publication.citationCount)),
      publicationVenues: [...author.venues].sort(),
      publications: author.publications.sort((left, right) => right.citationCount - left.citationCount)
    }))
    .filter((author) => author.hIndex >= minimum)
    .sort((left, right) => right.hIndex - left.hIndex || left.authorName.localeCompare(right.authorName));
}

export function getQ1InfluenceNetwork() {
  const db = ensureDatabase();
  const q1PublisherRows = db.prepare(`
    SELECT DISTINCT authored.SourceNodeID AS authorId
    FROM Edges authored
    JOIN Edges published
      ON published.SourceNodeID = authored.TargetNodeID
     AND published.EdgeType = 'PUBLISHED_IN'
    JOIN Venues v
      ON v.NodeID = published.TargetNodeID
    WHERE authored.EdgeType = 'AUTHORED'
      AND v.Quartile = 'Q1'
  `).all();

  const q1Set = new Set(q1PublisherRows.map((row) => row.authorId));
  const coAuthorEdges = db.prepare(`
    SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
    FROM Edges
    WHERE EdgeType = 'CO_AUTHOR'
    ORDER BY Weight DESC, EdgeID
  `).all();

  const qualifying = new Set();
  const linkedBy = new Map();

  for (const edge of coAuthorEdges) {
    if (q1Set.has(edge.SourceNodeID)) {
      qualifying.add(edge.TargetNodeID);
      linkedBy.set(edge.TargetNodeID, [...(linkedBy.get(edge.TargetNodeID) || []), edge.SourceNodeID]);
    }

    if (q1Set.has(edge.TargetNodeID)) {
      qualifying.add(edge.SourceNodeID);
      linkedBy.set(edge.SourceNodeID, [...(linkedBy.get(edge.SourceNodeID) || []), edge.TargetNodeID]);
    }
  }

  const networkIds = [...new Set([...q1Set, ...qualifying])];
  const placeholders = listToPlaceholders(networkIds);
  const nodeRows = db.prepare(`
    SELECT NodeID, NodeType, DisplayLabel
    FROM Nodes
    WHERE NodeID IN (${placeholders})
    ORDER BY DisplayLabel
  `).all(...networkIds);

  const nodes = nodeRows.map((row) =>
    mapGraphNode(row, {
      isQ1Publisher: q1Set.has(row.NodeID),
      isInfluencedAuthor: qualifying.has(row.NodeID)
    })
  );

  const edges = db.prepare(`
    SELECT EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight
    FROM Edges
    WHERE EdgeType = 'CO_AUTHOR'
      AND SourceNodeID IN (${placeholders})
      AND TargetNodeID IN (${placeholders})
    ORDER BY Weight DESC, EdgeID
  `).all(...networkIds, ...networkIds).map(mapGraphEdge);

  const authorLookup = new Map(nodeRows.map((row) => [row.NodeID, row.DisplayLabel]));
  const qualifyingAuthors = [...qualifying]
    .map((authorId) => ({
      authorId,
      authorName: authorLookup.get(authorId),
      linkedToQ1Authors: [...new Set(linkedBy.get(authorId) || [])]
        .map((linkedAuthorId) => authorLookup.get(linkedAuthorId))
        .sort()
    }))
    .sort((left, right) => left.authorName.localeCompare(right.authorName));

  return {
    definition: "A Q1 journal is any venue stored with Quartile = 'Q1' in the Venues table. A qualifying author has a direct CO_AUTHOR edge to at least one author who has published in a Q1 venue.",
    qualifyingAuthors,
    nodes,
    edges
  };
}
