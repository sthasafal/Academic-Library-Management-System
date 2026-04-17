export const graphs = [
  {
    id: 1,
    name: "Collaboration Graph",
    description: "Authors, institutions, and collaboration relationships for network analysis."
  },
  {
    id: 2,
    name: "Citation Graph",
    description: "Publication citation structure used for influence metrics such as h-index."
  },
  {
    id: 3,
    name: "Venue Influence Graph",
    description: "Author-publication-venue paths enriched with journal quartile metadata."
  }
];

export const institutions = [
  { id: 101, name: "Rocky Mountain University", country: "USA" },
  { id: 102, name: "Pacific Tech", country: "USA" },
  { id: 103, name: "Lakeside Research Institute", country: "Canada" },
  { id: 104, name: "Global Science Lab", country: "UK" }
];

export const authors = [
  { id: 1, fullName: "Alice Carter", researchArea: "Scholarly Graph Analytics", email: "alice.carter@rmu.edu", institutionId: 101 },
  { id: 2, fullName: "Ben Ortiz", researchArea: "Digital Libraries", email: "ben.ortiz@rmu.edu", institutionId: 101 },
  { id: 3, fullName: "Chloe Zhang", researchArea: "Citation Networks", email: "chloe.zhang@pacifictech.edu", institutionId: 102 },
  { id: 4, fullName: "Daniel Kim", researchArea: "Metadata Systems", email: "daniel.kim@pacifictech.edu", institutionId: 102 },
  { id: 5, fullName: "Emma Patel", researchArea: "Scholarly Repositories", email: "emma.patel@lri.ca", institutionId: 103 },
  { id: 6, fullName: "Farah Nasser", researchArea: "Research Impact Modeling", email: "farah.nasser@lri.ca", institutionId: 103 },
  { id: 7, fullName: "Grace Liu", researchArea: "Human-Centered Discovery", email: "grace.liu@gsl.ac.uk", institutionId: 104 },
  { id: 8, fullName: "Henry Brooks", researchArea: "Science Mapping", email: "henry.brooks@gsl.ac.uk", institutionId: 104 }
];

export const venues = [
  { id: 201, name: "Journal of Graph Analytics", kind: "Journal", quartile: "Q1", impactScore: 9.4 },
  { id: 202, name: "Data Systems Review", kind: "Journal", quartile: "Q2", impactScore: 6.8 },
  { id: 203, name: "Network Science Letters", kind: "Journal", quartile: "Q1", impactScore: 8.9 },
  { id: 204, name: "Library Informatics Conference", kind: "Conference", quartile: null, impactScore: 5.3 },
  { id: 205, name: "Scholarly Data Mining Journal", kind: "Journal", quartile: "Q1", impactScore: 9.1 },
  { id: 206, name: "Regional Library Technology Review", kind: "Journal", quartile: "Q3", impactScore: 4.7 }
];

export const publications = [
  { id: 301, title: "Graph Models for Digital Libraries", year: 2020, doi: "10.1000/alms.301", venueId: 201, authorIds: [1, 2] },
  { id: 302, title: "Citation Flows in Academic Archives", year: 2021, doi: "10.1000/alms.302", venueId: 203, authorIds: [1, 3] },
  { id: 303, title: "Metadata-Driven Discovery Systems", year: 2021, doi: "10.1000/alms.303", venueId: 202, authorIds: [1, 4] },
  { id: 304, title: "Institutional Collaboration Graphs", year: 2022, doi: "10.1000/alms.304", venueId: 205, authorIds: [1, 5] },
  { id: 305, title: "Temporal Citation Networks", year: 2022, doi: "10.1000/alms.305", venueId: 201, authorIds: [1, 6] },
  { id: 306, title: "Knowledge Graph Interfaces for Librarians", year: 2023, doi: "10.1000/alms.306", venueId: 204, authorIds: [2, 7] },
  { id: 307, title: "Research Data Stewardship at Scale", year: 2020, doi: "10.1000/alms.307", venueId: 202, authorIds: [3, 4] },
  { id: 308, title: "Ranking Scholarly Venues with Graph Signals", year: 2023, doi: "10.1000/alms.308", venueId: 205, authorIds: [3, 5] },
  { id: 309, title: "Q1-Aware Recommendation Paths", year: 2024, doi: "10.1000/alms.309", venueId: 201, authorIds: [3, 6] },
  { id: 310, title: "Journal Influence Mapping", year: 2021, doi: "10.1000/alms.310", venueId: 203, authorIds: [3, 8] },
  { id: 311, title: "Library AI Collaboration Atlas", year: 2022, doi: "10.1000/alms.311", venueId: 204, authorIds: [5, 7] },
  { id: 312, title: "Repository Search Optimization", year: 2024, doi: "10.1000/alms.312", venueId: 206, authorIds: [2, 4] },
  { id: 313, title: "Cross-Institutional Scholar Graphs", year: 2023, doi: "10.1000/alms.313", venueId: 205, authorIds: [5, 6] },
  { id: 314, title: "Author Disambiguation in Repositories", year: 2022, doi: "10.1000/alms.314", venueId: 201, authorIds: [1, 3, 5] },
  { id: 315, title: "Venue Signals for Academic Discovery", year: 2024, doi: "10.1000/alms.315", venueId: 203, authorIds: [1, 3] }
];

export const citationPairs = [
  [306, 301], [307, 301], [308, 301], [309, 301], [310, 301],
  [301, 302], [304, 302], [305, 302], [308, 302], [313, 302], [315, 302],
  [301, 303], [302, 303], [307, 303], [310, 303], [314, 303],
  [302, 304], [305, 304], [309, 304], [311, 304], [315, 304],
  [301, 305], [303, 305], [308, 305], [310, 305], [312, 305],
  [301, 307], [304, 307], [306, 307], [309, 307], [313, 307],
  [302, 308], [305, 308], [310, 308], [314, 308], [315, 308],
  [301, 309], [307, 309], [311, 309], [314, 309], [315, 309],
  [303, 310], [305, 310], [308, 310], [312, 310], [314, 310],
  [302, 314], [304, 314], [306, 314], [309, 314], [311, 314],
  [303, 315], [305, 315], [308, 315], [310, 315], [313, 315]
];
