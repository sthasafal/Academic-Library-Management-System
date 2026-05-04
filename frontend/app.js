const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const authTabs = [...document.querySelectorAll("[data-auth-tab]")];
const authForms = [...document.querySelectorAll("[data-auth-form]")];
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const authMessage = document.querySelector("#auth-message");
const sessionUser = document.querySelector("#session-user");
const logoutButton = document.querySelector("#logout-button");
const pages = [...document.querySelectorAll("[data-page]")];
const pageLinks = [...document.querySelectorAll("[data-page-link]")];

const authorsCount = document.querySelector("#authors-count");
const publicationsCount = document.querySelector("#publications-count");
const venuesCount = document.querySelector("#venues-count");
const relationshipsCount = document.querySelector("#relationships-count");
const graphCatalog = document.querySelector("#graph-catalog");

const authorSelect = document.querySelector("#author-select");
const coauthorYearFilter = document.querySelector("#coauthor-year-filter");
const toggleAuthoredEdges = document.querySelector("#toggle-authored-edges");
const togglePublishedEdges = document.querySelector("#toggle-published-edges");
const toggleAffiliationEdges = document.querySelector("#toggle-affiliation-edges");
const refreshCoauthorGraphButton = document.querySelector("#refresh-coauthor-graph");
const exportCoauthorGraphButton = document.querySelector("#export-coauthor-graph");
const coauthorDefinition = document.querySelector("#coauthor-definition");
const authorProfile = document.querySelector("#author-profile");
const researcherStats = document.querySelector("#researcher-stats");
const coauthorListBody = document.querySelector("#coauthor-list-body");
const authorPublicationsBody = document.querySelector("#author-publications-body");
const coauthorNodeDetail = document.querySelector("#coauthor-node-detail");

const searchType = document.querySelector("#search-type");
const searchInput = document.querySelector("#search-input");
const searchSuggestions = document.querySelector("#search-suggestions");
const searchYearFrom = document.querySelector("#search-year-from");
const searchYearTo = document.querySelector("#search-year-to");
const searchQuartile = document.querySelector("#search-quartile");
const searchCountry = document.querySelector("#search-country");
const searchVenueKind = document.querySelector("#search-venue-kind");
const searchQ1Only = document.querySelector("#search-q1-only");
const searchButton = document.querySelector("#search-button");
const exportSearchResultsButton = document.querySelector("#export-search-results");
const searchResultsHead = document.querySelector("#search-results-head");
const searchResultsBody = document.querySelector("#search-results-body");
const institutionAuthorsBody = document.querySelector("#institution-authors-body");
const venueList = document.querySelector("#venue-list");
const collectionsBody = document.querySelector("#collections-body");

const managementEntity = document.querySelector("#management-entity");
const managementResetButton = document.querySelector("#management-reset");
const exportManagementRecordsButton = document.querySelector("#export-management-records");
const managementMessage = document.querySelector("#management-message");
const managementForm = document.querySelector("#management-form");
const managementRecordsHead = document.querySelector("#management-records-head");
const managementRecordsBody = document.querySelector("#management-records-body");

const impactDefinition = document.querySelector("#impact-definition");
const impactBody = document.querySelector("#impact-body");
const influentialYearFrom = document.querySelector("#influential-year-from");
const influentialQ1Only = document.querySelector("#influential-q1-only");
const refreshInfluentialAuthorsButton = document.querySelector("#refresh-influential-authors");
const exportInfluentialAuthorsButton = document.querySelector("#export-influential-authors");
const influentialAuthorsBody = document.querySelector("#influential-authors-body");
const q1Definition = document.querySelector("#q1-definition");
const q1AuthorsElement = document.querySelector("#q1-authors");
const exportQ1GraphButton = document.querySelector("#export-q1-graph");
const q1NodeDetail = document.querySelector("#q1-node-detail");
const pathSourceAuthor = document.querySelector("#path-source-author");
const pathTargetAuthor = document.querySelector("#path-target-author");
const runShortestPathButton = document.querySelector("#run-shortest-path");
const exportPathGraphButton = document.querySelector("#export-path-graph");
const shortestPathSummary = document.querySelector("#shortest-path-summary");
const institutionRankingBody = document.querySelector("#institution-ranking-body");

let coauthorGraph;
let q1Graph;
let pathGraph;
let hasLoadedLibraryData = false;

const defaultPage = "dashboard";
const usersStorageKey = "academic-library-users";
const sessionStorageKey = "academic-library-session";
const state = {
  authors: [],
  referenceData: { authors: [], institutions: [], venues: [], publications: [] },
  collections: { publications: [], venues: [] },
  searchResults: [],
  influentialAuthors: [],
  institutionRanking: [],
  management: {
    entity: "authors",
    editingId: null,
    editingNode: null
  }
};

function fetchJson(url) {
  return fetch(url).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || `Request failed for ${url}`);
    }

    return response.json();
  });
}

function sendJson(url, method, payload) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result?.message || `Request failed for ${url}`);
    }

    return result;
  });
}

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(usersStorageKey)) || [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(usersStorageKey, JSON.stringify(users));
}

function getCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionStorageKey));
  } catch {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(sessionStorageKey, JSON.stringify({ name: user.name, email: user.email }));
}

function clearAuthMessage() {
  authMessage.textContent = "";
  authMessage.classList.remove("is-error");
}

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
}

function showAuthForm(formName) {
  clearAuthMessage();

  for (const tab of authTabs) {
    tab.classList.toggle("is-active", tab.dataset.authTab === formName);
  }

  for (const form of authForms) {
    form.classList.toggle("is-active", form.dataset.authForm === formName);
  }
}

async function showLibraryApp(user) {
  authScreen.hidden = true;
  appShell.hidden = false;
  sessionUser.textContent = user.name;

  try {
    if (!hasLoadedLibraryData) {
      await bootstrap();
      hasLoadedLibraryData = true;
    } else {
      showPage();
    }
  } catch (error) {
    handleBootstrapError(error);
  }
}

function showAuthScreen() {
  appShell.hidden = true;
  authScreen.hidden = false;
  sessionUser.textContent = "";
}

async function handleLogin(event) {
  event.preventDefault();
  const email = loginForm.elements["login-email"].value.trim().toLowerCase();
  const password = loginForm.elements["login-password"].value;
  const user = getStoredUsers().find((storedUser) => storedUser.email === email);

  if (!user || user.password !== password) {
    showAuthMessage("Email or password does not match.", true);
    return;
  }

  saveSession(user);
  loginForm.reset();
  await showLibraryApp(user);
}

async function handleSignup(event) {
  event.preventDefault();
  const name = signupForm.elements["signup-name"].value.trim();
  const email = signupForm.elements["signup-email"].value.trim().toLowerCase();
  const password = signupForm.elements["signup-password"].value;
  const users = getStoredUsers();

  if (!name) {
    showAuthMessage("Enter your full name.", true);
    return;
  }

  if (users.some((user) => user.email === email)) {
    showAuthMessage("An account already exists for that email.", true);
    return;
  }

  const user = { name, email, password };
  users.push(user);
  saveStoredUsers(users);
  saveSession(user);
  signupForm.reset();
  await showLibraryApp(user);
}

function logout() {
  localStorage.removeItem(sessionStorageKey);
  showAuthForm("login");
  showAuthScreen();
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

function selectedValues(selectElement) {
  return [...selectElement.selectedOptions].map((option) => Number(option.value)).filter(Boolean);
}

function parseIntegerOrNull(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : null;
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
          return `"${normalized.replaceAll('"', '""')}"`
        })
        .join(",")
    )
  ];
  return lines.join("\n");
}

function downloadText(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, rows) {
  downloadText(filename, toCsv(rows), "text/csv;charset=utf-8");
}

function renderSummary(summary) {
  authorsCount.textContent = summary.authors;
  publicationsCount.textContent = summary.publications;
  venuesCount.textContent = summary.venues;
  relationshipsCount.textContent = summary.relationships;
}

function renderGraphs(graphs) {
  graphCatalog.innerHTML = graphs.map((graph) => `
    <article class="graph-card">
      <p class="eyebrow">Graph ${graph.GraphID}</p>
      <h3>${escapeHtml(graph.GraphName)}</h3>
      <p>${escapeHtml(graph.Description)}</p>
      <div class="metric-strip compact">
        <div class="metric-block">
          <span>Nodes</span>
          <strong>${graph.nodeCount}</strong>
        </div>
        <div class="metric-block">
          <span>Edges</span>
          <strong>${graph.edgeCount}</strong>
        </div>
      </div>
    </article>
  `).join("");
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
    for (const graph of [coauthorGraph, q1Graph, pathGraph]) {
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

function createGraph(containerId, nodes, edges, options = {}) {
  const { edgeLabelField = "type" } = options;
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
          "text-wrap": "wrap",
          "text-max-width": 90,
          "text-valign": "center",
          "text-halign": "center",
          width: 50,
          height: 50,
          "background-color": "#2f6f7e",
          "border-width": 2,
          "border-color": "#fff9f3",
          opacity: 1
        }
      },
      {
        selector: 'node[type = "Publication"]',
        style: {
          shape: "round-rectangle",
          width: 74,
          height: 34,
          "background-color": "#d3b271"
        }
      },
      {
        selector: 'node[type = "Venue"]',
        style: {
          shape: "diamond",
          width: 58,
          height: 58,
          "background-color": "#7c8d5a"
        }
      },
      {
        selector: 'node[type = "Institution"]',
        style: {
          shape: "hexagon",
          width: 58,
          height: 58,
          "background-color": "#7a5b4f"
        }
      },
      {
        selector: "node[?isFocus]",
        style: {
          width: 62,
          height: 62,
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
        selector: "node.is-neighborhood",
        style: {
          "border-color": "#214d3f",
          "border-width": 4
        }
      },
      {
        selector: "node.is-dimmed, edge.is-dimmed",
        style: {
          opacity: 0.18
        }
      },
      {
        selector: "edge",
        style: {
          width: "mapData(weight, 1, 5, 2, 8)",
          label: `data(${edgeLabelField})`,
          "font-size": 9,
          color: "#5b584f",
          "curve-style": "bezier",
          "line-color": "rgba(30, 29, 26, 0.25)",
          "target-arrow-color": "rgba(30, 29, 26, 0.25)",
          "target-arrow-shape": "none",
          opacity: 0.9
        }
      }
    ]
  });
}

function highlightNeighborhood(graph, node) {
  graph.elements().removeClass("is-neighborhood is-dimmed");
  graph.elements().addClass("is-dimmed");
  node.closedNeighborhood().removeClass("is-dimmed").addClass("is-neighborhood");
  node.removeClass("is-dimmed");
}

async function renderNodeDetail(container, nodeId) {
  const detail = await fetchJson(`/api/nodes/${nodeId}`);
  const details = detail.details || {};
  const graphs = (detail.graphs || []).map((graph) => graph.GraphName).join(", ");
  const attributeRows = Object.entries(detail.attributes || {})
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}</dd></div>`)
    .join("");

  container.innerHTML = `
    <p class="eyebrow">Node Detail</p>
    <h3>${escapeHtml(detail.label)}</h3>
    <p class="table-note">${escapeHtml(detail.type)} / Graphs: ${escapeHtml(graphs || "None")}</p>
    <dl class="profile-list compact">${attributeRows || "<div><dt>Details</dt><dd>No additional attributes.</dd></div>"}</dl>
    ${details.publicationYear ? `<p class="table-note">Published in ${escapeHtml(details.venueName)} (${details.publicationYear}) with ${details.citationCount} citations.</p>` : ""}
    ${details.institutionName ? `<p class="table-note">${escapeHtml(details.institutionName)} / ${escapeHtml(details.institutionCountry || "")}</p>` : ""}
  `;
}

function bindGraphInteractions(graph, detailContainer) {
  graph.on("tap", "node", async (event) => {
    highlightNeighborhood(graph, event.target);
    await renderNodeDetail(detailContainer, event.target.id());
  });
}

function downloadGraphPng(graph, filename) {
  if (!graph) {
    return;
  }

  const uri = graph.png({ full: true, bg: "#ffffff", scale: 2 });
  const link = document.createElement("a");
  link.href = uri;
  link.download = filename;
  link.click();
}

function populateAuthorSelects(authors) {
  const options = authors.map((author) => `
    <option value="${author.NodeID}">${escapeHtml(author.FullName)} - ${escapeHtml(author.institutionName)}</option>
  `).join("");

  authorSelect.innerHTML = options;
  pathSourceAuthor.innerHTML = options;
  pathTargetAuthor.innerHTML = options;
}

function searchParamsFromFilters() {
  const params = new URLSearchParams({
    type: searchType.value,
    q: searchInput.value.trim()
  });

  if (searchYearFrom.value.trim()) {
    params.set("yearFrom", searchYearFrom.value.trim());
  }
  if (searchYearTo.value.trim()) {
    params.set("yearTo", searchYearTo.value.trim());
  }
  if (searchQuartile.value) {
    params.set("quartile", searchQuartile.value);
  }
  if (searchCountry.value.trim()) {
    params.set("country", searchCountry.value.trim());
  }
  if (searchVenueKind.value) {
    params.set("venueKind", searchVenueKind.value);
  }
  if (searchQ1Only.checked) {
    params.set("q1Only", "true");
  }

  return params;
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

async function loadCoauthors() {
  if (!authorSelect.value) {
    return;
  }

  const params = new URLSearchParams({
    authorId: authorSelect.value
  });

  if (coauthorYearFilter.value.trim()) {
    params.set("yearFrom", coauthorYearFilter.value.trim());
  }
  if (toggleAuthoredEdges.checked) {
    params.set("includeAuthored", "true");
  }
  if (togglePublishedEdges.checked) {
    params.set("includePublished", "true");
  }
  if (toggleAffiliationEdges.checked) {
    params.set("includeAffiliations", "true");
  }

  const result = await fetchJson(`/api/query/coauthors?${params.toString()}`);
  coauthorDefinition.textContent = result.definition;
  renderResearcherDetails(result);
  coauthorGraph?.destroy();
  const coauthorEdges = result.edges.map((edge) => ({
    ...edge,
    sharedLabel: String(edge.weight)
  }));
  coauthorGraph = createGraph("coauthor-graph", result.nodes, coauthorEdges, { edgeLabelField: "sharedLabel" });
  bindGraphInteractions(coauthorGraph, coauthorNodeDetail);
}

function renderCollections() {
  venueList.innerHTML = state.collections.venues.map((venue) => `
    <article class="venue-card">
      <span>${escapeHtml(venue.venueKind)}${venue.quartile ? ` / ${escapeHtml(venue.quartile)}` : ""}</span>
      <strong>${escapeHtml(venue.name)}</strong>
      <small>${venue.publicationCount} publications / impact ${venue.impactScore}</small>
    </article>
  `).join("");

  collectionsBody.innerHTML = state.collections.publications.map((publication) => `
    <tr>
      <td>${escapeHtml(publication.title)}</td>
      <td>${publication.publicationYear}</td>
      <td>${escapeHtml(publication.authors)}</td>
      <td>${escapeHtml(publication.venueName)}</td>
      <td>${escapeHtml(publication.doi)}</td>
    </tr>
  `).join("");
}

function renderSearchResults() {
  const type = searchType.value;
  const results = state.searchResults;

  if (results.length === 0) {
    searchResultsHead.innerHTML = "<tr><th>No results</th></tr>";
    searchResultsBody.innerHTML = "<tr><td>No matching records found.</td></tr>";
    institutionAuthorsBody.innerHTML = "<tr><td colspan='4'>Select an institution to view its authors.</td></tr>";
    return;
  }

  if (type === "authors") {
    searchResultsHead.innerHTML = `
      <tr>
        <th>Author Name</th>
        <th>Research Area</th>
        <th>Institution</th>
        <th>Email</th>
      </tr>
    `;
    searchResultsBody.innerHTML = results.map((author) => `
      <tr>
        <td>${escapeHtml(author.FullName)}</td>
        <td>${escapeHtml(author.ResearchArea)}</td>
        <td>${escapeHtml(author.institutionName)}</td>
        <td>${escapeHtml(author.Email || "")}</td>
      </tr>
    `).join("");
    return;
  }

  if (type === "publications") {
    searchResultsHead.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Year</th>
        <th>Authors</th>
        <th>Venue</th>
        <th>Quartile</th>
      </tr>
    `;
    searchResultsBody.innerHTML = results.map((publication) => `
      <tr>
        <td>${escapeHtml(publication.title)}</td>
        <td>${publication.publicationYear}</td>
        <td>${escapeHtml(publication.authors)}</td>
        <td>${escapeHtml(publication.venueName)}</td>
        <td>${escapeHtml(publication.quartile ?? "-")}</td>
      </tr>
    `).join("");
    return;
  }

  if (type === "institutions") {
    searchResultsHead.innerHTML = `
      <tr>
        <th>Institution</th>
        <th>Country</th>
        <th>Authors</th>
      </tr>
    `;
    searchResultsBody.innerHTML = results.map((institution) => `
      <tr class="institution-row" data-institution-id="${institution.institutionId}">
        <td>${escapeHtml(institution.name)}</td>
        <td>${escapeHtml(institution.country)}</td>
        <td>${institution.authorCount}</td>
      </tr>
    `).join("");
    return;
  }

  searchResultsHead.innerHTML = `
    <tr>
      <th>Venue Name</th>
      <th>Type</th>
      <th>Quartile</th>
      <th>Impact Score</th>
      <th>Publication Count</th>
    </tr>
  `;
  searchResultsBody.innerHTML = results.map((venue) => `
    <tr>
      <td>${escapeHtml(venue.name)}</td>
      <td>${escapeHtml(venue.venueKind)}</td>
      <td>${escapeHtml(venue.quartile ?? "-")}</td>
      <td>${venue.impactScore}</td>
      <td>${venue.publicationCount}</td>
    </tr>
  `).join("");
}

async function runSearch() {
  state.searchResults = await fetchJson(`/api/search?${searchParamsFromFilters().toString()}`);
  renderSearchResults();
}

async function loadSuggestions() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchSuggestions.innerHTML = "";
    return;
  }

  const suggestions = await fetchJson(`/api/search/suggestions?type=${encodeURIComponent(searchType.value)}&q=${encodeURIComponent(query)}`);
  searchSuggestions.innerHTML = suggestions
    .map((suggestion) => `<option value="${escapeHtml(suggestion.label)}"></option>`)
    .join("");
}

async function loadInstitutionAuthors(institutionId) {
  const authors = await fetchJson(`/api/institutions/${institutionId}/authors`);
  institutionAuthorsBody.innerHTML = authors.map((author) => `
    <tr>
      <td>${escapeHtml(author.FullName)}</td>
      <td>${escapeHtml(author.ResearchArea)}</td>
      <td>${escapeHtml(author.Email)}</td>
      <td>${escapeHtml(author.institutionName)}</td>
    </tr>
  `).join("");
}

async function loadImpact() {
  const result = await fetchJson("/api/query/h-index?minimum=5");
  impactDefinition.textContent = result.definition;
  impactBody.innerHTML = result.authors.map((author) => `
    <tr>
      <td>${escapeHtml(author.authorName)}</td>
      <td>${author.hIndex}</td>
      <td>${escapeHtml(author.publicationVenues.join(", "))}</td>
      <td>${author.publications.slice(0, 3).map((publication) => `${escapeHtml(publication.title)} (${publication.citationCount})`).join("<br />")}</td>
    </tr>
  `).join("");
}

async function loadInfluentialAuthors() {
  const params = new URLSearchParams({ limit: "10" });
  if (influentialYearFrom.value.trim()) {
    params.set("yearFrom", influentialYearFrom.value.trim());
  }
  if (influentialQ1Only.checked) {
    params.set("q1Only", "true");
  }

  state.influentialAuthors = await fetchJson(`/api/query/influential-authors?${params.toString()}`);
  influentialAuthorsBody.innerHTML = state.influentialAuthors.map((author) => `
    <tr>
      <td>${escapeHtml(author.authorName)}</td>
      <td>${author.citationCount}</td>
      <td>${author.hIndex}</td>
      <td>${author.citationScore}</td>
      <td>${escapeHtml(author.venues.join(", "))}</td>
    </tr>
  `).join("");
}

async function loadQ1Influence() {
  const result = await fetchJson("/api/query/q1-influence");
  q1Definition.textContent = result.definition;
  q1AuthorsElement.innerHTML = result.qualifyingAuthors.map((author) => `
    <div class="pill">
      <strong>${escapeHtml(author.authorName)}</strong>
      <span>Linked to: ${escapeHtml(author.linkedToQ1Authors.join(", "))}</span>
    </div>
  `).join("");

  q1Graph?.destroy();
  q1Graph = createGraph("q1-graph", result.nodes, result.edges);
  bindGraphInteractions(q1Graph, q1NodeDetail);
}

async function runShortestPath() {
  if (!pathSourceAuthor.value || !pathTargetAuthor.value) {
    return;
  }

  const result = await fetchJson(
    `/api/query/shortest-path?sourceAuthorId=${encodeURIComponent(pathSourceAuthor.value)}&targetAuthorId=${encodeURIComponent(pathTargetAuthor.value)}`
  );
  shortestPathSummary.textContent = result.hopCount === 0
    ? `Selected the same author: ${result.pathAuthorNames[0]}.`
    : `${result.pathAuthorNames.join(" -> ")} (${pluralize(result.hopCount, "hop")}).`;

  pathGraph?.destroy();
  pathGraph = createGraph("shortest-path-graph", result.nodes, result.edges);
}

async function loadInstitutionRanking() {
  state.institutionRanking = await fetchJson("/api/query/institution-collaboration");
  institutionRankingBody.innerHTML = state.institutionRanking.map((pair) => `
    <tr>
      <td>${escapeHtml(pair.leftInstitutionName)} / ${escapeHtml(pair.rightInstitutionName)}</td>
      <td>${pair.sharedPublications}</td>
      <td>${escapeHtml(pair.sampleTitles.slice(0, 3).join(", "))}</td>
    </tr>
  `).join("");
}

function showManagementMessage(message, isError = false) {
  managementMessage.textContent = message;
  managementMessage.classList.toggle("is-error", isError);
}

function optionList(items, valueKey, labelKey, selectedValuesList = []) {
  return items.map((item) => {
    const value = item[valueKey];
    const selected = selectedValuesList.includes(value) ? "selected" : "";
    return `<option value="${value}" ${selected}>${escapeHtml(item[labelKey])}</option>`;
  }).join("");
}

function renderManagementForm() {
  const entity = state.management.entity;
  const detail = state.management.editingNode;
  const attributes = detail?.attributes || {};
  const details = detail?.details || {};
  const isEditing = Boolean(state.management.editingId);

  if (entity === "institutions") {
    managementForm.innerHTML = `
      <div class="form-grid">
        <label>Institution name<input name="name" value="${escapeHtml(attributes.name || "")}" required /></label>
        <label>Country<input name="country" value="${escapeHtml(attributes.country || "")}" required /></label>
      </div>
      <button type="submit">${isEditing ? "Update institution" : "Create institution"}</button>
    `;
    return;
  }

  if (entity === "authors") {
    managementForm.innerHTML = `
      <div class="form-grid">
        <label>Full name<input name="fullName" value="${escapeHtml(attributes.fullName || "")}" required /></label>
        <label>Research area<input name="researchArea" value="${escapeHtml(attributes.researchArea || "")}" required /></label>
        <label>Email<input name="email" type="email" value="${escapeHtml(attributes.email || "")}" required /></label>
        <label>Institution
          <select name="institutionId" required>
            ${optionList(state.referenceData.institutions, "institutionId", "name", attributes.institutionId ? [attributes.institutionId] : [])}
          </select>
        </label>
        <label>Affiliation start year<input name="affiliationStartYear" type="number" min="1900" value="2020" /></label>
        <label>Affiliation role<input name="affiliationRole" value="Faculty" /></label>
      </div>
      <button type="submit">${isEditing ? "Update author" : "Create author"}</button>
    `;
    return;
  }

  if (entity === "venues") {
    managementForm.innerHTML = `
      <div class="form-grid">
        <label>Venue name<input name="name" value="${escapeHtml(attributes.name || "")}" required /></label>
        <label>Venue kind
          <select name="kind" required>
            <option value="Journal" ${(attributes.venueKind || attributes.kind) === "Journal" ? "selected" : ""}>Journal</option>
            <option value="Conference" ${(attributes.venueKind || attributes.kind) === "Conference" ? "selected" : ""}>Conference</option>
          </select>
        </label>
        <label>Quartile
          <select name="quartile">
            <option value="">None</option>
            ${["Q1", "Q2", "Q3", "Q4"].map((quartile) => `<option value="${quartile}" ${(attributes.quartile || "") === quartile ? "selected" : ""}>${quartile}</option>`).join("")}
          </select>
        </label>
        <label>Impact score<input name="impactScore" type="number" min="0" step="0.1" value="${escapeHtml(attributes.impactScore || "")}" required /></label>
      </div>
      <button type="submit">${isEditing ? "Update venue" : "Create venue"}</button>
    `;
    return;
  }

  const selectedAuthorIds = attributes.authorIds || details.authors?.map((author) => author.authorId) || [];
  const selectedCitationIds = details.citationTargetIds || [];
  managementForm.innerHTML = `
    <div class="form-grid">
      <label>Title<input name="title" value="${escapeHtml(attributes.title || "")}" required /></label>
      <label>Year<input name="year" type="number" min="1900" value="${escapeHtml(attributes.publicationYear || attributes.year || "")}" required /></label>
      <label>DOI<input name="doi" value="${escapeHtml(attributes.doi || "")}" required /></label>
      <label>Venue
        <select name="venueId" required>
          ${optionList(state.referenceData.venues, "venueId", "name", attributes.venueId ? [attributes.venueId] : [])}
        </select>
      </label>
      <label>Authors
        <select name="authorIds" multiple required>
          ${optionList(state.referenceData.authors, "NodeID", "FullName", selectedAuthorIds)}
        </select>
      </label>
      <label>Cited publications
        <select name="citationTargetIds" multiple>
          ${optionList(
            state.referenceData.publications.filter((publication) => publication.publicationId !== state.management.editingId),
            "publicationId",
            "title",
            selectedCitationIds
          )}
        </select>
      </label>
    </div>
    <button type="submit">${isEditing ? "Update publication" : "Create publication"}</button>
  `;
}

function managementRowsForEntity(entity) {
  if (entity === "institutions") {
    return {
      records: state.referenceData.institutions,
      headers: ["Institution", "Country", "Authors", "Actions"],
      rows: state.referenceData.institutions.map((institution) => `
        <tr>
          <td>${escapeHtml(institution.name)}</td>
          <td>${escapeHtml(institution.country)}</td>
          <td>${institution.authorCount}</td>
          <td>
            <button data-edit-entity="institutions" data-node-id="${institution.institutionId}" type="button">Edit</button>
            <button data-delete-entity="institutions" data-node-id="${institution.institutionId}" type="button">Delete</button>
          </td>
        </tr>
      `)
    };
  }

  if (entity === "authors") {
    return {
      records: state.referenceData.authors,
      headers: ["Author", "Research Area", "Institution", "Email", "Actions"],
      rows: state.referenceData.authors.map((author) => `
        <tr>
          <td>${escapeHtml(author.FullName)}</td>
          <td>${escapeHtml(author.ResearchArea)}</td>
          <td>${escapeHtml(author.institutionName)}</td>
          <td>${escapeHtml(author.Email)}</td>
          <td>
            <button data-edit-entity="authors" data-node-id="${author.NodeID}" type="button">Edit</button>
            <button data-delete-entity="authors" data-node-id="${author.NodeID}" type="button">Delete</button>
          </td>
        </tr>
      `)
    };
  }

  if (entity === "venues") {
    return {
      records: state.referenceData.venues,
      headers: ["Venue", "Type", "Quartile", "Impact", "Actions"],
      rows: state.referenceData.venues.map((venue) => `
        <tr>
          <td>${escapeHtml(venue.name)}</td>
          <td>${escapeHtml(venue.venueKind)}</td>
          <td>${escapeHtml(venue.quartile ?? "-")}</td>
          <td>${venue.impactScore}</td>
          <td>
            <button data-edit-entity="venues" data-node-id="${venue.venueId}" type="button">Edit</button>
            <button data-delete-entity="venues" data-node-id="${venue.venueId}" type="button">Delete</button>
          </td>
        </tr>
      `)
    };
  }

  return {
    records: state.referenceData.publications,
    headers: ["Publication", "Year", "Venue", "DOI", "Actions"],
    rows: state.referenceData.publications.map((publication) => `
      <tr>
        <td>${escapeHtml(publication.title)}</td>
        <td>${publication.publicationYear}</td>
        <td>${escapeHtml(publication.venueName)}</td>
        <td>${escapeHtml(publication.doi)}</td>
        <td>
          <button data-edit-entity="publications" data-node-id="${publication.publicationId}" type="button">Edit</button>
          <button data-delete-entity="publications" data-node-id="${publication.publicationId}" type="button">Delete</button>
        </td>
      </tr>
    `)
  };
}

function renderManagementRecords() {
  const { headers, rows } = managementRowsForEntity(state.management.entity);
  managementRecordsHead.innerHTML = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  managementRecordsBody.innerHTML = rows.join("");
}

function renderManagementUi() {
  renderManagementForm();
  renderManagementRecords();
}

function resetManagementForm() {
  state.management.editingId = null;
  state.management.editingNode = null;
  showManagementMessage("");
  renderManagementUi();
}

async function refreshReferenceData() {
  state.referenceData = await fetchJson("/api/reference-data");
  state.authors = state.referenceData.authors;
  populateAuthorSelects(state.authors);
  if (state.authors.length > 1 && !pathTargetAuthor.value) {
    pathTargetAuthor.value = String(state.authors[1].NodeID);
  }
}

async function reloadAllData() {
  const selectedAuthorId = authorSelect.value;
  const selectedSourceId = pathSourceAuthor.value;
  const selectedTargetId = pathTargetAuthor.value;

  const [summary, graphs, collections] = await Promise.all([
    fetchJson("/api/summary"),
    fetchJson("/api/graphs"),
    fetchJson("/api/collections")
  ]);
  renderSummary(summary);
  renderGraphs(graphs);
  state.collections = collections;
  renderCollections();

  await refreshReferenceData();

  if (selectedAuthorId && state.authors.some((author) => String(author.NodeID) === selectedAuthorId)) {
    authorSelect.value = selectedAuthorId;
  }
  if (selectedSourceId && state.authors.some((author) => String(author.NodeID) === selectedSourceId)) {
    pathSourceAuthor.value = selectedSourceId;
  }
  if (selectedTargetId && state.authors.some((author) => String(author.NodeID) === selectedTargetId)) {
    pathTargetAuthor.value = selectedTargetId;
  }

  renderManagementUi();
  await Promise.all([loadCoauthors(), loadImpact(), loadQ1Influence(), loadInfluentialAuthors(), loadInstitutionRanking(), runSearch()]);
}

function managementPayloadFromForm() {
  const formData = new FormData(managementForm);
  const entity = state.management.entity;

  if (entity === "institutions") {
    return {
      name: formData.get("name"),
      country: formData.get("country")
    };
  }

  if (entity === "authors") {
    return {
      fullName: formData.get("fullName"),
      researchArea: formData.get("researchArea"),
      email: formData.get("email"),
      institutionId: Number(formData.get("institutionId")),
      affiliationStartYear: Number(formData.get("affiliationStartYear") || 2020),
      affiliationRole: formData.get("affiliationRole") || "Faculty"
    };
  }

  if (entity === "venues") {
    return {
      name: formData.get("name"),
      kind: formData.get("kind"),
      quartile: formData.get("quartile"),
      impactScore: Number(formData.get("impactScore"))
    };
  }

  return {
    title: formData.get("title"),
    year: Number(formData.get("year")),
    doi: formData.get("doi"),
    venueId: Number(formData.get("venueId")),
    authorIds: selectedValues(managementForm.querySelector('[name="authorIds"]')),
    citationTargetIds: selectedValues(managementForm.querySelector('[name="citationTargetIds"]'))
  };
}

async function handleManagementSubmit(event) {
  event.preventDefault();

  try {
    const entity = state.management.entity;
    const payload = managementPayloadFromForm();
    const basePath = `/${entity}`;

    if (state.management.editingId) {
      await sendJson(`/api${basePath}/${state.management.editingId}`, "PUT", payload);
      showManagementMessage(`Updated ${entity.slice(0, -1)} successfully.`);
    } else {
      await sendJson(`/api${basePath}`, "POST", payload);
      showManagementMessage(`Created ${entity.slice(0, -1)} successfully.`);
    }

    resetManagementForm();
    await reloadAllData();
  } catch (error) {
    showManagementMessage(error.message, true);
  }
}

async function editManagementRecord(entity, nodeId) {
  state.management.entity = entity;
  managementEntity.value = entity;
  state.management.editingId = nodeId;
  state.management.editingNode = await fetchJson(`/api/nodes/${nodeId}`);
  showManagementMessage(`Editing ${state.management.editingNode.label}.`);
  renderManagementUi();
}

async function deleteManagementRecord(entity, nodeId) {
  try {
    await fetch(`/api/${entity}/${nodeId}`, { method: "DELETE" }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Delete failed.");
      }
    });
    showManagementMessage(`Deleted ${entity.slice(0, -1)} successfully.`);
    resetManagementForm();
    await reloadAllData();
  } catch (error) {
    showManagementMessage(error.message, true);
  }
}

async function bootstrap() {
  const [summary, graphs, collections] = await Promise.all([
    fetchJson("/api/summary"),
    fetchJson("/api/graphs"),
    fetchJson("/api/collections")
  ]);
  renderSummary(summary);
  renderGraphs(graphs);
  state.collections = collections;
  renderCollections();

  await refreshReferenceData();
  renderManagementUi();

  if (state.authors.length > 0) {
    authorSelect.value = String(state.authors[0].NodeID);
    pathSourceAuthor.value = String(state.authors[0].NodeID);
    pathTargetAuthor.value = String(state.authors[Math.min(1, state.authors.length - 1)].NodeID);
  }

  await Promise.all([loadCoauthors(), loadImpact(), loadQ1Influence(), loadInfluentialAuthors(), loadInstitutionRanking(), runSearch()]);
  showPage();
}

searchButton.addEventListener("click", () => {
  runSearch().catch(handleBootstrapError);
});

searchInput.addEventListener("input", () => {
  loadSuggestions().catch(() => {
    searchSuggestions.innerHTML = "";
  });
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch().catch(handleBootstrapError);
  }
});

searchType.addEventListener("change", () => {
  searchSuggestions.innerHTML = "";
  runSearch().catch(handleBootstrapError);
});

searchResultsBody.addEventListener("click", (event) => {
  const row = event.target.closest(".institution-row");
  if (!row) {
    return;
  }

  loadInstitutionAuthors(row.dataset.institutionId).catch(handleBootstrapError);
});

authorSelect.addEventListener("change", () => {
  loadCoauthors().catch(handleBootstrapError);
});
refreshCoauthorGraphButton.addEventListener("click", () => {
  loadCoauthors().catch(handleBootstrapError);
});
exportCoauthorGraphButton.addEventListener("click", () => {
  downloadGraphPng(coauthorGraph, "coauthor-network.png");
});

exportQ1GraphButton.addEventListener("click", () => {
  downloadGraphPng(q1Graph, "q1-influence-network.png");
});

runShortestPathButton.addEventListener("click", () => {
  runShortestPath().catch(handleBootstrapError);
});
exportPathGraphButton.addEventListener("click", () => {
  downloadGraphPng(pathGraph, "shortest-path-network.png");
});

refreshInfluentialAuthorsButton.addEventListener("click", () => {
  loadInfluentialAuthors().catch(handleBootstrapError);
});

exportSearchResultsButton.addEventListener("click", () => {
  downloadCsv(`search-results-${searchType.value}.csv`, state.searchResults);
});

exportManagementRecordsButton.addEventListener("click", () => {
  const { records } = managementRowsForEntity(state.management.entity);
  downloadCsv(`${state.management.entity}.csv`, records);
});

exportInfluentialAuthorsButton.addEventListener("click", () => {
  downloadCsv("influential-authors.csv", state.influentialAuthors);
});

managementEntity.addEventListener("change", () => {
  state.management.entity = managementEntity.value;
  resetManagementForm();
});

managementResetButton.addEventListener("click", () => {
  resetManagementForm();
});

managementForm.addEventListener("submit", (event) => {
  handleManagementSubmit(event).catch(handleBootstrapError);
});

managementRecordsBody.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-entity]");
  if (editButton) {
    editManagementRecord(editButton.dataset.editEntity, Number(editButton.dataset.nodeId)).catch(handleBootstrapError);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-entity]");
  if (deleteButton) {
    deleteManagementRecord(deleteButton.dataset.deleteEntity, Number(deleteButton.dataset.nodeId)).catch(handleBootstrapError);
  }
});

window.addEventListener("hashchange", showPage);

for (const tab of authTabs) {
  tab.addEventListener("click", () => showAuthForm(tab.dataset.authTab));
}

loginForm.addEventListener("submit", handleLogin);
signupForm.addEventListener("submit", handleSignup);
logoutButton.addEventListener("click", logout);

const currentSession = getCurrentSession();
if (currentSession) {
  showLibraryApp(currentSession).catch(handleBootstrapError);
} else {
  showAuthScreen();
}

function handleBootstrapError(error) {
  console.error(error);
  showManagementMessage(error.message || "Something went wrong.", true);
}
