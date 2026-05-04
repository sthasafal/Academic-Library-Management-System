# Academic Library Management System

Academic library management system built around a graph-oriented data model. The current repo includes:

- A normalized schema centered on `Nodes` and `Edges`
- Multi-graph membership through mapping tables
- A shared seeded dataset with 18 authors, 6 institutions, 10 venues, and 32 publications
- CRUD operations for authors, institutions, venues, and publications
- Core graph analytics for authors, publications, venues, and institutions
- Advanced search, live suggestions, CSV export, and graph image export
- A browser UI with interactive network visualization and node drill-down
- Explicit multi-graph membership tracking and dashboard visibility
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

## Required Query Coverage

1. Co-author network with mandatory visualization
2. h-index filter for authors with h-index >= 5, including publication venues and an explicit h-index definition
3. Q1 journal influence network with an explicit Q1 definition based on `Venues.Quartile = 'Q1'`

## Spec Traceability

- Project requirement mapping: `PROJECT_SPEC_CHECKLIST.md`
- Flask API entry point: `backend/app.py`
- Query logic and seeded graph model: `backend/python_backend.py`
- Frontend visualization: `frontend/app.js`
- Automated verification: `tests/`

## Project Structure

- `backend/app.py`: Flask application entry point
- `backend/python_backend.py`: Python SQLite initialization and query logic
- `backend/graphService.js`: JavaScript query service used by Node tests
- `database/seed_data.json`: shared canonical seed dataset used by both runtimes
- `database/schema.sql`: relational schema for nodes, edges, subtype tables, and graph membership
- `database/seedData.js`: JavaScript seed loader and citation generation for tests
- `database/`: SQLite schema, connection, initialization, and seed helpers
- `frontend/`: static frontend and visualizations
- `tests/`: automated graph query tests


## Analytics

1. Co-author network: one-hop author collaboration network using `CO_AUTHOR` edges.
2. h-index filter: authors whose authored publications have at least `h` incoming `CITES` edges for `h` papers.
3. Q1 journal influence network: authors connected by `CO_AUTHOR` edges to authors who published in venues where `Quartile = 'Q1'`.
4. Shortest collaboration path: computes the minimum-hop co-author route between two authors.
5. Influence ranking: ranks authors by aggregated citation volume across their publications.
6. Institution collaboration ranking: identifies the strongest cross-institution publication partnerships.
