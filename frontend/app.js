const authorSelect = document.querySelector("#author-select");
const coauthorDefinition = document.querySelector("#coauthor-definition");
const authorProfile = document.querySelector("#author-profile");
const researcherStats = document.querySelector("#researcher-stats");
const coauthorListBody = document.querySelector("#coauthor-list-body");
const authorPublicationsBody = document.querySelector("#author-publications-body");
const impactDefinition = document.querySelector("#impact-definition");
const impactBody = document.querySelector("#impact-body");
const q1Definition = document.querySelector("#q1-definition");
const q1AuthorsElement = document.querySelector("#q1-authors");
const venueList = document.querySelector("#venue-list");
const collectionsBody = document.querySelector("#collections-body");
const authorsCount = document.querySelector("#authors-count");
const publicationsCount = document.querySelector("#publications-count");
const venuesCount = document.querySelector("#venues-count");
const relationshipsCount = document.querySelector("#relationships-count");
const pages = [...document.querySelectorAll("[data-page]")];
const pageLinks = [...document.querySelectorAll("[data-page-link]")];

let coauthorGraph;
let q1Graph;
const defaultPage = "dashboard";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatNameList(value) {
  if (!value) {
    return "No listed co-authors";
  }

  return String(value).split(",").join(", ");
}

function renderSummary(summary) {
  authorsCount.textContent = summary.authors;
  publicationsCount.textContent = summary.publications;
  venuesCount.textContent = summary.venues;
  relationshipsCount.textContent = summary.relationships;
}

function getRequestedPage() {
  const requestedPage = window.location.hash.replace("#", "");
  return pages.some((page) => page.dataset.page === requestedPage) ? requestedPage : defaultPage;
}

function refreshVisibleGraphs(activePage) {
  if (activePage !== "researchers" && activePage !== "analytics") {
    return;
  }

  requestAnimationFrame(() => {
    for (const graph of [coauthorGraph, q1Graph]) {
      graph?.resize();
      graph?.fit(undefined, 24);
    }
  });
}

function showPage() {
  const activePage = getRequestedPage();

  for (const page of pages) {
    page.classList.toggle("is-active", page.dataset.page === activePage);
  }

  for (const link of pageLinks) {
    link.classList.toggle("is-active", link.dataset.pageLink === activePage);
  }

  refreshVisibleGraphs(activePage);
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
        selector: "node[?isFocus]",
        style: {
          width: 60,
          height: 60,
          "background-color": "#bc4f2a"
        }
      },
      {
        selector: "node[?isQ1Publisher]",
        style: {
          "background-color": "#bc4f2a"
        }
      },
      {
        selector: "node[?isInfluencedAuthor]",
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
  renderAuthorOptions(authors);

  authorSelect.addEventListener("change", () => {
    loadCoauthors(authorSelect.value);
  });

  if (authors.length > 0) {
    await loadCoauthors(authors[0].NodeID);
  }
}

function renderAuthorOptions(authors) {
  if (authors.length === 0) {
    authorSelect.innerHTML = "<option>No researchers found</option>";
    authorSelect.disabled = true;
    return;
  }

  const currentValue = authorSelect.value;
  authorSelect.innerHTML = authors
    .map((author) => `<option value="${author.NodeID}">${escapeHtml(author.FullName)} - ${escapeHtml(author.institutionName)}</option>`)
    .join("");
  authorSelect.disabled = false;

  if (authors.some((author) => String(author.NodeID) === currentValue)) {
    authorSelect.value = currentValue;
  }
}

async function loadCoauthors(authorId) {
  const result = await fetchJson(`/api/query/coauthors?authorId=${authorId}`);
  coauthorDefinition.textContent = result.definition;
  renderResearcherDetails(result);
  coauthorGraph?.destroy();
  coauthorGraph = createGraph("coauthor-graph", result.nodes, result.edges);
}

function renderResearcherDetails(result) {
  const author = result.author;
  const summary = result.summary;
  const strongest = summary.strongestCollaboration
    ? `${escapeHtml(summary.strongestCollaboration.authorName)} (${pluralize(summary.strongestCollaboration.sharedPublications, "shared publication")})`
    : "No co-authors yet";

  authorProfile.innerHTML = `
    <p class="eyebrow">Selected Author</p>
    <h3>${escapeHtml(author.FullName)}</h3>
    <dl class="profile-list">
      <div>
        <dt>Research area</dt>
        <dd>${escapeHtml(author.ResearchArea)}</dd>
      </div>
      <div>
        <dt>Institution</dt>
        <dd>${escapeHtml(author.institutionName)} (${escapeHtml(author.institutionCountry)})</dd>
      </div>
      <div>
        <dt>Email</dt>
        <dd>${escapeHtml(author.Email)}</dd>
      </div>
    </dl>
  `;

  researcherStats.innerHTML = `
    <div class="metric-block">
      <span>Direct co-authors</span>
      <strong>${summary.directCoauthors}</strong>
    </div>
    <div class="metric-block">
      <span>Publications</span>
      <strong>${summary.publicationCount}</strong>
    </div>
    <div class="metric-block">
      <span>Shared works</span>
      <strong>${summary.sharedPublications}</strong>
    </div>
    <div class="metric-block wide">
      <span>Strongest collaboration</span>
      <strong>${strongest}</strong>
    </div>
  `;

  coauthorListBody.innerHTML = result.collaborators.length === 0
    ? "<tr><td colspan='4'>No co-authors found for this researcher.</td></tr>"
    : result.collaborators.map((collaborator) => {
      const recentSharedWork = collaborator.sharedPublicationsList
        .slice(0, 2)
        .map((publication) => `${escapeHtml(publication.title)} (${publication.publicationYear})`)
        .join("<br />");

      return `
        <tr>
          <td>
            <strong>${escapeHtml(collaborator.authorName)}</strong>
            <span class="table-note">${escapeHtml(collaborator.researchArea)}</span>
          </td>
          <td>${escapeHtml(collaborator.institutionName)}</td>
          <td>${pluralize(collaborator.sharedPublications, "publication")}</td>
          <td>${recentSharedWork || "No shared publication listed"}</td>
        </tr>
      `;
    }).join("");

  authorPublicationsBody.innerHTML = result.publications.length === 0
    ? "<tr><td colspan='4'>No publications found for this researcher.</td></tr>"
    : result.publications.map((publication) => `
      <tr>
        <td>
          <strong>${escapeHtml(publication.title)}</strong>
          <span class="table-note">With ${escapeHtml(formatNameList(publication.coauthors))}</span>
        </td>
        <td>${publication.publicationYear}</td>
        <td>${escapeHtml(publication.venueName)}${publication.quartile ? ` / ${escapeHtml(publication.quartile)}` : ""}</td>
        <td>${publication.citationCount}</td>
      </tr>
    `).join("");
}

async function loadCollections() {
  const collections = await fetchJson("/api/collections");
  venueList.innerHTML = collections.venues.map((venue) => `
    <article class="venue-card">
      <span>${venue.venueKind}${venue.quartile ? ` / ${venue.quartile}` : ""}</span>
      <strong>${venue.name}</strong>
      <small>${venue.publicationCount} publications / impact ${venue.impactScore}</small>
    </article>
  `).join("");

  collectionsBody.innerHTML = collections.publications.map((publication) => `
    <tr>
      <td>${publication.title}</td>
      <td>${publication.publicationYear}</td>
      <td>${publication.authors}</td>
      <td>${publication.venueName}</td>
      <td>${publication.doi}</td>
    </tr>
  `).join("");
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
  showPage();
  const summary = await fetchJson("/api/summary");
  renderSummary(summary);
  await Promise.all([loadAuthors(), loadCollections(), loadImpact(), loadQ1Influence()]);
  showPage();
}

window.addEventListener("hashchange", showPage);

bootstrap().catch((error) => {
  console.error(error);
  document.body.innerHTML = "<main class='page'><section class='panel'><h2>Error</h2><p>Failed to load system data.</p></section></main>";
});
