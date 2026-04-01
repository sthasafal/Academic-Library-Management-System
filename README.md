# Academic Library Management System

Academic library management system built around a graph-oriented data model. The current repo includes:

- A normalized schema centered on `Nodes` and `Edges`
- Multi-graph membership through mapping tables
- A seeded academic dataset
- Core graph analytics for authors, publications, venues, and institutions
- A browser UI with network visualization
- System design documentation and an ER diagram source

## Stack

- Database: SQLite
- Backend: Python + Flask
- Visualization: Cytoscape.js

## Quick Start

```bash
python3 -m pip install -r requirements.txt
python3 app.py
```

Open `http://localhost:3000`.

## Useful Commands

```bash
python3 app.py --init-db
npm test
```

## Project Structure

- `app.py`: Flask application entry point
- `python_backend.py`: Python SQLite initialization and query logic
- `src/db/schema.sql`: relational schema for nodes, edges, subtype tables, and graph membership
- `src/data/seedData.js`: seeded authors, publications, venues, and citation relationships
- `public/`: static frontend and visualizations
- `docs/er-diagram.mmd`: ER diagram source
- `docs/system-design.md`: system design and architecture notes

## Analytics

1. Co-author network: one-hop author collaboration network using `CO_AUTHOR` edges.
2. h-index filter: authors whose authored publications have at least `h` incoming `CITES` edges for `h` papers.
3. Q1 journal influence network: authors connected by `CO_AUTHOR` edges to authors who published in venues where `Quartile = 'Q1'`.
