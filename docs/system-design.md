# System Design Notes

## Overview
This system models an academic library as a graph-oriented information platform. Authors, institutions, publications, and venues are represented as nodes, while collaboration, authorship, citation, affiliation, and publication relationships are represented as edges.

## Core Data Model
The main graph structure is built on:

- `Nodes(NodeID, NodeType, DisplayLabel, CreatedAt)`
- `Edges(EdgeID, SourceNodeID, TargetNodeID, EdgeType, EdgeYear, Weight, MetadataJson)`
- `Graphs`, `NodeGraphs`, and `EdgeGraphs` for multi-graph membership

Entity-specific details are stored in:

- `Authors(NodeID, FullName, ResearchArea, Email)`
- `Institutions(NodeID, Name, Country)`
- `Publications(NodeID, Title, PublicationYear, DOI)`
- `Venues(NodeID, Name, VenueKind, Quartile, ImpactScore)`

## Design Rationale
The schema keeps graph identity separate from entity-specific attributes. This reduces sparse records, avoids repeated metadata, and allows a single node or edge to appear in multiple graph views.

## Implemented Capabilities
The current system supports:

1. Co-author network exploration with interactive visualization.
2. h-index analysis based on citation relationships between publications.
3. Q1 journal influence analysis using venue quartile metadata.

## Frontend
The browser interface provides:

- Dataset summary cards
- Author selection for co-author exploration
- Interactive network views with Cytoscape.js
- Analytical tables for citation-based metrics

## Backend
The Python and Flask backend exposes REST endpoints for summary data, author lookup, and graph analytics. SQLite is used as the local database engine for fast iteration and simple deployment.
