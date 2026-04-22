const authScreen = document.querySelector("#auth-screen");
const appShell = document.querySelector("#app-shell");
const authTabs = [...document.querySelectorAll("[data-auth-tab]")];
const authForms = [...document.querySelectorAll("[data-auth-form]")];
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const authMessage = document.querySelector("#auth-message");
const sessionUser = document.querySelector("#session-user");
const logoutButton = document.querySelector("#logout-button");
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
const searchType = document.querySelector("#search-type");
const searchInput = document.querySelector("#search-input");
const searchButton = document.querySelector("#search-button");
const searchResultsHead = document.querySelector("#search-results-head");
const searchResultsBody = document.querySelector("#search-results-body");
const institutionAuthorsBody = document.querySelector("#institution-authors-body");

let coauthorGraph;
let q1Graph;
let hasLoadedLibraryData = false;
const defaultPage = "dashboard";
const usersStorageKey = "academic-library-users";
const sessionStorageKey = "academic-library-session";

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed for ${url}`);
    }

    return response.json();
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

async function runSearch() {
  const type = searchType.value;
  const query = searchInput.value.trim();
  const results = await fetchJson(`/api/search/${type}?q=${encodeURIComponent(query)}`);

  if (results.length === 0) {
    searchResultsHead.innerHTML = `<tr><th>No results</th></tr>`;
    searchResultsBody.innerHTML = `
      <tr>
        <td>No matching records found.</td>
      </tr>
    `;
    institutionAuthorsBody.innerHTML = `
      <tr>
        <td colspan="4">Select an institution to view its authors.</td>
      </tr>
    `;
    return;
  }

  institutionAuthorsBody.innerHTML = "";

  if (type === "authors") {
    searchResultsHead.innerHTML = `
      <tr>
        <th>Author Name</th>
        <th>Research Area</th>
        <th>Institution</th>
      </tr>
    `;

    searchResultsBody.innerHTML = results.map((author) => `
      <tr>
        <td>${author.FullName}</td>
        <td>${author.ResearchArea}</td>
        <td>${author.institutionName}</td>
      </tr>
    `).join("");
  }

  if (type === "publications") {
    searchResultsHead.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Year</th>
        <th>Authors</th>
        <th>Venue</th>
        <th>DOI</th>
      </tr>
    `;

    searchResultsBody.innerHTML = results.map((publication) => `
      <tr>
        <td>${publication.title}</td>
        <td>${publication.publicationYear}</td>
        <td>${publication.authors}</td>
        <td>${publication.venueName}</td>
        <td>${publication.doi}</td>
      </tr>
    `).join("");
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
      <tr class="institution-row" data-institution-id="${institution.institutionId}" style="cursor:pointer;">
        <td>${institution.name}</td>
        <td>${institution.country}</td>
        <td>${institution.authorCount}</td>
      </tr>
    `).join("");

    document.querySelectorAll(".institution-row").forEach((row) => {
      row.addEventListener("click", async () => {
        const institutionId = row.dataset.institutionId;
        const authors = await fetchJson(`/api/institutions/${institutionId}/authors`);

        institutionAuthorsBody.innerHTML = authors.map((author) => `
          <tr>
            <td>${author.FullName}</td>
            <td>${author.ResearchArea}</td>
            <td>${author.Email}</td>
            <td>${author.institutionName}</td>
          </tr>
        `).join("");
      });
    });
  }

  if (type === "venues") {
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
        <td>${venue.name}</td>
        <td>${venue.venueKind}</td>
        <td>${venue.quartile ?? "-"}</td>
        <td>${venue.impactScore}</td>
        <td>${venue.publicationCount}</td>
      </tr>
    `).join("");
  }
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
  await runSearch();
  showPage();
}

searchButton.addEventListener("click", () => {
  runSearch();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});

searchType.addEventListener("change", () => {
  institutionAuthorsBody.innerHTML = `
    <tr>
      <td colspan="4">Select an institution to view its authors.</td>
    </tr>
  `;
});

window.addEventListener("hashchange", showPage);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});

searchType.addEventListener("change", () => {
  institutionAuthorsBody.innerHTML = `
    <tr>
      <td colspan="4">Select an institution to view its authors.</td>
    </tr>
  `;
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
  document.body.innerHTML = "<main class='page'><section class='panel'><h2>Error</h2><p>Failed to load system data.</p></section></main>";
}
