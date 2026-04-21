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
python -m pip install -r requirements.txt
python backend/app.py
```

Open `http://localhost:3000`.

## Useful Commands

```bash
python backend/app.py --init-db
npm test
```

## Project Structure

- `backend/app.py`: Flask application entry point
- `backend/python_backend.py`: Python SQLite initialization and query logic
- `backend/graphService.js`: JavaScript query service used by Node tests
- `database/schema.sql`: relational schema for nodes, edges, subtype tables, and graph membership
- `database/seedData.js`: seeded authors, publications, venues, and citation relationships
- `database/`: SQLite schema, connection, initialization, and seed helpers
- `frontend/`: static frontend and visualizations
- `tests/`: automated graph query tests


## Analytics

1. Co-author network: one-hop author collaboration network using `CO_AUTHOR` edges.
2. h-index filter: authors whose authored publications have at least `h` incoming `CITES` edges for `h` papers.
3. Q1 journal influence network: authors connected by `CO_AUTHOR` edges to authors who published in venues where `Quartile = 'Q1'`.
