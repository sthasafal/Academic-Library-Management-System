const authorSelect = document.querySelector("#author-select");
const coauthorDefinition = document.querySelector("#coauthor-definition");
const impactDefinition = document.querySelector("#impact-definition");
const impactBody = document.querySelector("#impact-body");
const q1Definition = document.querySelector("#q1-definition");
const q1AuthorsElement = document.querySelector("#q1-authors");
const authorsCount = document.querySelector("#authors-count");
const publicationsCount = document.querySelector("#publications-count");
const venuesCount = document.querySelector("#venues-count");
const relationshipsCount = document.querySelector("#relationships-count");

let coauthorGraph;
let q1Graph;

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed for ${url}`);
    }

    return response.json();
  });
}

function buildElements(nodes, edges) {
  return [
    ...nodes.map((node) => ({ data: node })),
    ...edges.map((edge) => ({ data: edge }))
  ];
}

function renderSummary(summary) {
  authorsCount.textContent = summary.authors;
  publicationsCount.textContent = summary.publications;
  venuesCount.textContent = summary.venues;
  relationshipsCount.textContent = summary.relationships;
}

function createGraph(containerId, nodes, edges, palette = {}) {
  return cytoscape({
    container: document.getElementById(containerId),
    elements: buildElements(nodes, edges),
    layout: {
      name: "cose",
      animate: true,
      padding: 24
    },
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "font-family": "Source Sans 3",
          "font-size": 11,
          color: "#1e1d1a",
          "text-valign": "center",
          "text-halign": "center",
          width: 48,
          height: 48,
          "background-color": palette.nodeColor || "#2f6f7e",
          "border-width": 2,
          "border-color": "#fff9f3"
        }
      },
      {
        selector: "node[isFocus]",
        style: {
          width: 60,
          height: 60,
          "background-color": "#bc4f2a"
        }
      },
      {
        selector: "node[isQ1Publisher]",
        style: {
          "background-color": "#bc4f2a"
        }
      },
      {
        selector: "node[isInfluencedAuthor]",
        style: {
          "background-color": "#1f7a68"
        }
      },
      {
        selector: "edge",
        style: {
          width: "mapData(weight, 1, 3, 2, 7)",
          label: "data(weight)",
          "font-size": 10,
          color: "#5b584f",
          "curve-style": "bezier",
          "line-color": palette.edgeColor || "rgba(30, 29, 26, 0.25)",
          "target-arrow-color": palette.edgeColor || "rgba(30, 29, 26, 0.25)",
          "target-arrow-shape": "none"
        }
      }
    ]
  });
}

async function loadAuthors() {
  const authors = await fetchJson("/api/authors");
  authorSelect.innerHTML = authors
    .map((author) => `<option value="${author.NodeID}">${author.FullName} · ${author.institutionName}</option>`)
    .join("");

  authorSelect.addEventListener("change", () => {
    loadCoauthors(authorSelect.value);
  });

  if (authors.length > 0) {
    await loadCoauthors(authors[0].NodeID);
  }
}

async function loadCoauthors(authorId) {
  const result = await fetchJson(`/api/query/coauthors?authorId=${authorId}`);
  coauthorDefinition.textContent = result.definition;
  coauthorGraph?.destroy();
  coauthorGraph = createGraph("coauthor-graph", result.nodes, result.edges);
}

async function loadImpact() {
  const authors = await fetchJson("/api/query/h-index?minimum=5");
  impactDefinition.textContent = "Impact score is based on citation performance across an author's publications.";

  impactBody.innerHTML = authors.map((author) => `
    <tr>
      <td>${author.authorName}</td>
      <td>${author.hIndex}</td>
      <td>${author.publicationVenues.join(", ")}</td>
      <td>${author.publications.slice(0, 3).map((publication) => `${publication.title} (${publication.citationCount})`).join("<br />")}</td>
    </tr>
  `).join("");
}

async function loadQ1Influence() {
  const result = await fetchJson("/api/query/q1-influence");
  q1Definition.textContent = result.definition;
  q1AuthorsElement.innerHTML = result.qualifyingAuthors.map((author) => `
    <div class="pill">
      <strong>${author.authorName}</strong>
      <span>Linked to: ${author.linkedToQ1Authors.join(", ")}</span>
    </div>
  `).join("");

  q1Graph?.destroy();
  q1Graph = createGraph("q1-graph", result.nodes, result.edges, { nodeColor: "#4a6670", edgeColor: "rgba(74, 102, 112, 0.35)" });
}

async function bootstrap() {
  const summary = await fetchJson("/api/summary");
  renderSummary(summary);
  await Promise.all([loadAuthors(), loadImpact(), loadQ1Influence()]);
}

bootstrap().catch((error) => {
  console.error(error);
  document.body.innerHTML = "<main class='page'><section class='panel'><h2>Error</h2><p>Failed to load system data.</p></section></main>";
});
