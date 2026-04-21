const authorSelect = document.querySelector("#author-select");
const coauthorDefinition = document.querySelector("#coauthor-definition");
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
    if (!response.ok) throw new Error(`Request failed for ${url}`);
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
  if (!authorsCount) return;
  authorsCount.textContent = summary.authors;
  publicationsCount.textContent = summary.publications;
  venuesCount.textContent = summary.venues;
  relationshipsCount.textContent = summary.relationships;
}

function getRequestedPage() {
  const requestedPage = window.location.hash.replace("#", "");
  return pages.some((p) => p.dataset.page === requestedPage)
    ? requestedPage
    : defaultPage;
}

function refreshVisibleGraphs(activePage) {
  if (activePage !== "researchers" && activePage !== "analytics") return;

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

function setView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("is-active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("is-active");
}

function showLogin() {
  setView("loginView");
}

function showSignup() {
  setView("signupView");
}

function showDashboard() {
  const user = JSON.parse(localStorage.getItem("user"));
  const welcome = document.getElementById("welcomeText");

  if (welcome && user) {
    welcome.textContent = "Welcome, " + user.email;
  }

  setView("dashboardView");
}

function login() {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  const msg = document.getElementById("loginMsg");

  const user = JSON.parse(localStorage.getItem("user"));

  if (!email || !password) {
    if (msg) msg.textContent = "Please fill all fields";
    return;
  }

  if (!user) {
    if (msg) msg.textContent = "No account found. Please signup.";
    return;
  }

  if (user.email === email && user.password === password) {
    if (msg) msg.textContent = "";
    showDashboard();
  } else {
    if (msg) msg.textContent = "Invalid email or password";
  }
}

function signup() {
  const email = document.getElementById("newEmail")?.value;
  const password = document.getElementById("newPassword")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;
  const msg = document.getElementById("signupMsg");

  if (!email || !password || !confirm) {
    if (msg) msg.textContent = "All fields are required";
    return;
  }

  if (password !== confirm) {
    if (msg) msg.textContent = "Passwords do not match";
    return;
  }

  localStorage.setItem("user", JSON.stringify({ email, password }));

  if (msg) msg.textContent = "Signup successful";

  setTimeout(showLogin, 800);
}

function logout() {
  localStorage.removeItem("user");
  showLogin();
}

const savedUser = localStorage.getItem("user");
if (savedUser) {
  showDashboard();
}

window.addEventListener("hashchange", showPage);
showPage();