const API_BASE = "http://127.0.0.1:8000";

const pageTitles = {
    dashboard: "Dashboard",
    "lost-found": "Lost & Found",
    maintenance: "Campus Issue Intelligence",
    "resource-exchange": "Campus Resource Exchange",
    about: "About CampusBridge"
};

let reports = [];


/* -----------------------------
   Navigation
----------------------------- */

function showPage(pageName) {
    const page = document.getElementById(`${pageName}-page`);

    if (!page) {
        console.error(`Page not found: ${pageName}-page`);
        return;
    }

    document.querySelectorAll(".page").forEach((section) => {
        section.classList.remove("active-page");
    });

    page.classList.add("active-page");

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.toggle(
            "active",
            link.dataset.page === pageName
        );
    });

    document.getElementById("page-title").textContent =
        pageTitles[pageName] || "Dashboard";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (pageName === "lost-found") {
        loadReports();
    }

    if (pageName === "maintenance") {
        loadMaintenanceData();
    }

    if (pageName === "resource-exchange") {
        renderResources();
    }
}


document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(link.dataset.page);
    });
});


/* -----------------------------
   API connection status
----------------------------- */

async function checkApiConnection() {
    const statusText = document.getElementById("api-status");
    const statusIndicator = document.querySelector(".status-indicator");

    try {
        const response = await fetch(`${API_BASE}/health`);

        if (!response.ok) {
            throw new Error("API health check failed");
        }

        statusText.textContent = "Connected";
        statusIndicator.classList.add("online");
        statusIndicator.classList.remove("offline");

    } catch (error) {
        statusText.textContent = "Not connected";
        statusIndicator.classList.add("offline");
        statusIndicator.classList.remove("online");

        console.error("API connection error:", error);
    }
}


/* -----------------------------
   Date handling
----------------------------- */

function setDefaultDate() {
    const dateInput = document.getElementById("report-date");

    const now = new Date();

    const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    dateInput.value = localDate;
}


/* -----------------------------
   HTML safety helper
----------------------------- */

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}


/* -----------------------------
   Load reports from database
----------------------------- */

async function loadReports() {
    const allReportsContainer = document.getElementById("all-reports");
    const recentReportsContainer = document.getElementById("recent-reports");

    try {
        const response = await fetch(`${API_BASE}/items`);

        if (!response.ok) {
            throw new Error("Could not retrieve reports");
        }

        reports = await response.json();

        updateStatistics();
        renderReports(allReportsContainer, reports);
        renderReports(recentReportsContainer, reports.slice(0, 5));

    } catch (error) {
        allReportsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Couldn't load reports</h3>
                <p>Check that the CampusBridge backend is running.</p>
            </div>
        `;

        recentReportsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Reports unavailable</h3>
                <p>Connect to the backend to view submitted reports.</p>
            </div>
        `;

        console.error("Error loading reports:", error);
    }
}


/* -----------------------------
   Dashboard statistics
----------------------------- */

function updateStatistics() {
    const lostCount = reports.filter(
        (report) => report.report_type === "lost"
    ).length;

    const foundCount = reports.filter(
        (report) => report.report_type === "found"
    ).length;

    document.getElementById("total-reports").textContent =
        reports.length;

    document.getElementById("lost-count").textContent =
        lostCount;

    document.getElementById("found-count").textContent =
        foundCount;

    // The matching endpoint works for individual reports.
    // We will calculate a reliable dashboard-wide match count later.
    document.getElementById("match-count").textContent = "—";
}


/* -----------------------------
   Display reports
----------------------------- */

function renderReports(container, reportList) {
    if (reportList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">▤</div>
                <h3>No reports yet</h3>
                <p>Submitted item reports will appear here.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = reportList.map((report) => {
        const type = report.report_type;
        const isLost = type === "lost";

        const itemName = escapeHtml(report.item_name);
        const category = escapeHtml(report.category);
        const location = escapeHtml(report.location);
        const date = escapeHtml(report.report_date);
        const description = escapeHtml(report.description);
        const status = escapeHtml(report.status || "open");

        return `
            <article class="report-row">

                <div class="report-main">

                    <div class="report-icon ${type}">
                        ${isLost ? "⌕" : "✓"}
                    </div>

                    <div class="report-details">
                        <h4>${itemName}</h4>

                        <p>
                            ${category} · ${location}<br>
                            ${date}
                        </p>
                    </div>

                </div>

                <div class="report-side">

                    <span class="badge ${type}">
                        ${isLost ? "LOST" : "FOUND"}
                    </span>

                    <span class="badge open">
                        ${status.toUpperCase()}
                    </span>

                    <button
                        class="small-action"
                        data-match-id="${Number(report.id)}"
                        data-match-name="${itemName}"
                    >
                        Find matches
                    </button>

                </div>

            </article>
        `;
    }).join("");
}


/* -----------------------------
   Submit a new report
----------------------------- */

const reportForm = document.getElementById("report-form");

reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("form-message");
    const submitButton = reportForm.querySelector(
        'button[type="submit"]'
    );

    const report = {
        report_type: document.getElementById("report-type").value,
        item_name: document.getElementById("item-name").value.trim(),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
        location: document.getElementById("location").value.trim(),
        report_date: document.getElementById("report-date").value
    };

    if (!report.report_date) {
        message.textContent = "Please select a date.";
        message.className = "form-message error";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    message.textContent = "";
    message.className = "form-message";

    try {
        const response = await fetch(`${API_BASE}/items`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(report)
        });

        const result = await response.json();

        if (!response.ok) {
            const detail = Array.isArray(result.detail)
                ? result.detail.map((item) => item.msg).join(", ")
                : result.detail;

            throw new Error(detail || "Could not submit the report.");
        }

        message.textContent =
            `Report submitted successfully! Report ID: ${result.report_id}`;

        message.className = "form-message success";

        reportForm.reset();
        setDefaultDate();

        await loadReports();

    } catch (error) {
        message.textContent = error.message;
        message.className = "form-message error";

        console.error("Error submitting report:", error);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit report →";
    }
});


/* -----------------------------
   Find possible matches
----------------------------- */

async function findMatches(reportId, itemName) {
    const resultsContainer = document.getElementById("match-results");

    showPage("lost-found");

    resultsContainer.innerHTML = `
        <div class="loading-message">
            Finding possible matches for ${escapeHtml(itemName)}...
        </div>
    `;

    try {
        const response = await fetch(
            `${API_BASE}/items/${reportId}/matches`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Could not find matches."
            );
        }

        if (result.possible_matches.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⌕</div>
                    <h3>No possible matches found</h3>
                    <p>
                        CampusBridge did not find any reports above its
                        current similarity threshold. This does not prove
                        that no matching item exists.
                    </p>
                </div>
            `;

            return;
        }

        resultsContainer.innerHTML = result.possible_matches.map((match) => {
            const reasons = match.reasons.map((reason) => `
                <span class="reason-chip">
                    ${escapeHtml(reason)}
                </span>
            `).join("");

            return `
                <article class="match-result-card">

                    <div class="match-result-top">
                        <div>
                            <h4>
                                ${escapeHtml(match.item_name)}
                            </h4>

                            <p>
                                ${escapeHtml(match.category)}
                                ·
                                ${escapeHtml(match.location)}
                            </p>
                        </div>

                        <span class="score-badge">
                            ${Number(match.similarity_score).toFixed(1)}%
                            similarity
                        </span>
                    </div>

                    <p>
                        ${escapeHtml(match.description)}
                    </p>

                    <div class="match-reasons">
                        ${reasons}
                    </div>



                    <div class="match-score-details">
    <h5>How was this score calculated?</h5>

    <div class="score-detail">
        <span>Item name similarity</span>
        <strong>${Number(match.name_score ?? 0).toFixed(1)}%</strong>
    </div>

    <div class="score-detail">
        <span>Description similarity</span>
        <strong>${Number(match.description_score ?? 0).toFixed(1)}%</strong>
    </div>

    <div class="score-detail">
        <span>Category agreement</span>
        <strong>${Number(match.category_score ?? 0).toFixed(1)}%</strong>
    </div>

    <div class="score-detail">
        <span>Location agreement</span>
        <strong>${Number(match.location_score ?? 0).toFixed(1)}%</strong>
    </div>

    <div class="score-detail">
        <span>Date proximity</span>
        <strong>${Number(match.date_score ?? 0).toFixed(1)}%</strong>
    </div>
</div>

                    <p class="match-note">
                        ${escapeHtml(match.note)}
                    </p>

                </article>
            `;
        }).join("");

    } catch (error) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Unable to find matches</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;

        console.error("Matching error:", error);
    }
}


/* -----------------------------
   Handle report match buttons
----------------------------- */

document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-match-id]");

    if (!button) {
        return;
    }

    const reportId = Number(button.dataset.matchId);
    const itemName = button.dataset.matchName;

    if (!Number.isInteger(reportId) || reportId <= 0) {
        return;
    }

    findMatches(reportId, itemName);
});


/* -----------------------------
   Header and dashboard buttons
----------------------------- */

document.getElementById("new-report-button").addEventListener(
    "click",
    () => {
        showPage("lost-found");

        document.getElementById("item-name").focus();
    }
);

document.getElementById("explore-button").addEventListener(
    "click",
    () => showPage("lost-found")
);

document.getElementById("view-all-button").addEventListener(
    "click",
    () => showPage("lost-found")
);

document.getElementById("refresh-button").addEventListener(
    "click",
    loadReports
);

document.getElementById("matching-button").addEventListener(
    "click",
    () => {
        showPage("lost-found");

        const firstLostReport = reports.find(
            (report) => report.report_type === "lost"
        );

        if (firstLostReport) {
            findMatches(
                firstLostReport.id,
                firstLostReport.item_name
            );
        } else {
            document.getElementById("match-results").innerHTML = `
                <div class="empty-state">
                    <h3>No lost-item report available</h3>
                    <p>Submit a lost-item report before searching for matches.</p>
                </div>
            `;
        }
    }
);



/* -----------------------------
   Campus Issue Intelligence
----------------------------- */

async function loadMaintenanceData() {
    const reportsContainer = document.getElementById(
        "maintenance-reports-list"
    );

    const relatedContainer = document.getElementById(
        "related-issues-list"
    );

    try {
        // Load all maintenance reports.
        const reportsResponse = await fetch(
            `${API_BASE}/maintenance`
        );

        if (!reportsResponse.ok) {
            throw new Error("Could not load maintenance reports.");
        }

        const maintenanceReports = await reportsResponse.json();

        // Update dashboard statistics.
        document.getElementById(
            "total-maintenance-reports"
        ).textContent = maintenanceReports.length;

        document.getElementById(
            "pending-maintenance-issues"
        ).textContent = maintenanceReports.filter(
            report => report.status === "pending"
        ).length;

        document.getElementById(
            "in-progress-maintenance-issues"
        ).textContent = maintenanceReports.filter(
            report => report.status === "in_progress"
        ).length;

        document.getElementById(
            "resolved-maintenance-issues"
        ).textContent = maintenanceReports.filter(
            report => report.status === "resolved"
        ).length;

        document.getElementById(
            "high-priority-issues"
        ).textContent = maintenanceReports.filter(
            report => report.severity === "high"
        ).length;

        const resolvedCount = maintenanceReports.filter(
            report => report.status === "resolved"
        ).length;

        const resolutionRate = maintenanceReports.length === 0
            ? 0
            : Math.round(
                (resolvedCount / maintenanceReports.length) * 100
            );

        document.getElementById(
            "maintenance-resolution-rate"
        ).textContent = `${resolutionRate}%`;

        // Display maintenance reports.
        if (maintenanceReports.length === 0) {
            reportsContainer.innerHTML = `
        <div class="empty-state">
            <h3>No campus issues yet</h3>
            <p>Submit a report to get started.</p>
        </div>
    `;
        } else {
            reportsContainer.innerHTML = maintenanceReports.map(
                report => `
            <article class="report-row">

                <div class="report-main">
                    <div class="report-details">
                        <h4>${escapeHtml(report.title)}</h4>

                        <p>
                            ${escapeHtml(report.category)}
                            ·
                            ${escapeHtml(report.location)}
                        </p>

                        <p>${escapeHtml(report.description)}</p>
                    </div>
                </div>

                <div class="report-side">

                    <span class="badge ${escapeHtml(report.severity)}">
                        ${escapeHtml(report.severity.toUpperCase())}
                    </span>

                    <span class="badge status-${escapeHtml(report.status)}">
                            ${escapeHtml(
                    report.status === "in_progress"
                        ? "IN PROGRESS"
                        : report.status.toUpperCase()
                )}
                        </span>

                    <div class="status-controls">

                        <label for="status-${report.id}">
                            Update status
                        </label>

                        <select
                            id="status-${report.id}"
                            class="status-select"
                        >
                            <option
                                value="pending"
                                ${report.status === "pending" ? "selected" : ""}
                            >
                                Pending
                            </option>

                            <option
                                value="in_progress"
                                ${report.status === "in_progress" ? "selected" : ""}
                            >
                                In Progress
                            </option>

                            <option
                                value="resolved"
                                ${report.status === "resolved" ? "selected" : ""}
                            >
                                Resolved
                            </option>
                        </select>

                        <button
                            type="button"
                            class="status-update-button"
                            onclick="updateMaintenanceStatus(${report.id})"
                        >
                            Update
                        </button>

                    </div>

                </div>

            </article>
        `
            ).join("");
        }

        // Load potentially related maintenance issues.
        const intelligenceResponse = await fetch(
            `${API_BASE}/maintenance/intelligence`
        );

        if (!intelligenceResponse.ok) {
            throw new Error("Could not load issue intelligence.");
        }

        const intelligence = await intelligenceResponse.json();

        document.getElementById(
            "related-issue-pairs"
        ).textContent = intelligence.related_pairs_found;

        // Display related issue pairs.
        // Display related issue pairs.
        if (intelligence.related_pairs.length === 0) {
            relatedContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No related issue pairs found</h3>
                    <p>
                        Similar reports may appear as more campus issues
                        are submitted.
                    </p>
                </div>
            `;
        } else {
            relatedContainer.innerHTML =
                intelligence.related_pairs.map(pair => `
                    <article class="content-card issue-intelligence-card">

                        <div class="issue-card-header">
                            <span class="issue-card-label">
                                POTENTIALLY RELATED
                            </span>

                            <span class="issue-similarity">
                                ${Number(pair.text_similarity).toFixed(1)}% similarity
                            </span>
                        </div>

                        <div class="compared-issues">

                            <div class="compared-issue">
                                <span class="issue-number">
                                    REPORT #${Number(pair.issue_1_id)}
                                </span>

                                <h4>
                                    ${escapeHtml(pair.issue_1_title ?? "Untitled report")}
                                </h4>

                                <p>
                                    📍 ${escapeHtml(pair.issue_1_location ?? "Unknown location")}
                                </p>
                            </div>

                            <div class="issue-connection" aria-hidden="true">
                                ↕
                            </div>

                            <div class="compared-issue">
                                <span class="issue-number">
                                    REPORT #${Number(pair.issue_2_id)}
                                </span>

                                <h4>
                                    ${escapeHtml(pair.issue_2_title ?? "Untitled report")}
                                </h4>

                                <p>
                                    📍 ${escapeHtml(pair.issue_2_location ?? "Unknown location")}
                                </p>
                            </div>

                        </div>

                        <div class="issue-analysis">
                            <div>
                                <span>Same location</span>
                                <strong>
                                    ${pair.same_location ? "Yes" : "No"}
                                </strong>
                            </div>

                            <div>
                                <span>Assessment</span>
                                <strong class="${pair.potentially_related
                        ? "assessment-positive"
                        : "assessment-review"
                    }">
                                    ${pair.potentially_related
                        ? "Potentially related"
                        : "Review required"
                    }
                                </strong>
                            </div>
                        </div>

                        <p class="issue-disclaimer">
                            These are algorithmic suggestions, not confirmed
                            duplicates. Human verification is required.
                        </p>

                    </article>
                `).join("");
        }

    } catch (error) {
        reportsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load campus issues</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;

        relatedContainer.innerHTML = `
            <div class="empty-state">
                <p>Issue intelligence is currently unavailable.</p>
            </div>
        `;

        console.error("Maintenance dashboard error:", error);
    }
}



/* -----------------------------
   Submit a Campus Issue
----------------------------- */

const maintenanceForm = document.getElementById("maintenance-form");

maintenanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById(
        "maintenance-form-message"
    );

    const submitButton = maintenanceForm.querySelector(
        'button[type="submit"]'
    );

    const issue = {
        title: document.getElementById("maintenance-title").value.trim(),

        description: document.getElementById(
            "maintenance-description"
        ).value.trim(),

        category: document.getElementById("maintenance-category").value,

        location: document.getElementById(
            "maintenance-location"
        ).value.trim(),

        severity: document.getElementById("maintenance-severity").value
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    message.textContent = "";
    message.className = "";

    try {
        const response = await fetch(`${API_BASE}/maintenance`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(issue)
        });

        const result = await response.json();

        if (!response.ok) {
            const detail = Array.isArray(result.detail)
                ? result.detail.map(item => item.msg).join(", ")
                : result.detail;

            throw new Error(
                detail || "Could not submit the campus issue."
            );
        }

        message.textContent =
            "Campus issue submitted successfully!";

        message.className = "form-message success";

        maintenanceForm.reset();

        await loadMaintenanceData();

    } catch (error) {
        message.textContent = error.message;
        message.className = "form-message error";

        console.error("Maintenance submission error:", error);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Issue";
    }
});
/* -----------------------------
   Campus Resource Exchange
   Listings are stored in the shared SQLite database via FastAPI.
----------------------------- */

const RESOURCE_STORAGE_KEY = "campusbridge_resources_v1";
let resourcesCache = [];
let resourceRequestInProgress = false;
let legacyMigrationAttempted = false;

function resourceApiError(result, fallback) {
    if (result && result.detail) {
        return Array.isArray(result.detail)
            ? result.detail.map((item) => item.msg || String(item)).join(", ")
            : result.detail;
    }
    return fallback;
}

async function migrateLegacyResources() {
    if (legacyMigrationAttempted) return;
    legacyMigrationAttempted = true;

    let legacyResources = [];
    try {
        legacyResources = JSON.parse(localStorage.getItem(RESOURCE_STORAGE_KEY) || "[]");
        if (!Array.isArray(legacyResources) || legacyResources.length === 0) return;
    } catch (error) {
        console.warn("Could not read legacy browser-only resource listings.", error);
        return;
    }

    // Track successful migrations after each item so a temporary failure can be retried
    // without re-posting listings that were already imported.
    const remaining = [];
    for (const oldResource of legacyResources) {
        if (oldResource && oldResource._migratedToApi) continue;

        const payload = {
            title: String(oldResource.title || "").trim(),
            category: String(oldResource.category || "").trim(),
            offering: ["lend", "give", "share"].includes(oldResource.offering)
                ? oldResource.offering : "share",
            location: String(oldResource.location || "").trim(),
            description: String(oldResource.description || "").trim()
        };

        if (payload.title.length < 3 || payload.category.length < 2 ||
            payload.location.length < 2 || payload.description.length < 5) {
            // Invalid legacy data is retained locally for recovery rather than silently discarded.
            remaining.push(oldResource);
            continue;
        }

        try {
            const response = await fetch(`${API_BASE}/resources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(resourceApiError(result, "Migration failed."));
            oldResource._migratedToApi = true;
            localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(legacyResources));
        } catch (error) {
            console.warn("A previous resource listing could not be migrated yet.", error);
            remaining.push(oldResource);
        }
    }

    const notMigrated = legacyResources.filter((resource) => !resource._migratedToApi);
    if (notMigrated.length === 0) {
        localStorage.removeItem(RESOURCE_STORAGE_KEY);
    } else {
        localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(notMigrated));
        // Retry any failed legacy imports on the next visit to this page.
        legacyMigrationAttempted = false;
    }
}

async function renderResources() {
    const list = document.getElementById("resource-list");
    if (!list) return;

    const query = (document.getElementById("resource-search")?.value || "").trim().toLowerCase();
    const category = document.getElementById("resource-category-filter")?.value || "all";
    const statusFilter = document.getElementById("resource-status-filter")?.value || "available";

    list.innerHTML = `<div class="empty-state"><h3>Loading resources…</h3><p>Fetching listings from CampusBridge.</p></div>`;

    try {
        await migrateLegacyResources();
        const response = await fetch(`${API_BASE}/resources`);
        const result = await response.json();
        if (!response.ok) throw new Error(resourceApiError(result, "Could not load resource listings."));

        resourcesCache = Array.isArray(result) ? result : [];
        const allResources = [...resourcesCache].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const filtered = allResources.filter((resource) => {
            const searchable = `${resource.title} ${resource.category} ${resource.location} ${resource.description} ${resource.offering}`.toLowerCase();
            return (!query || searchable.includes(query))
                && (category === "all" || resource.category === category)
                && (statusFilter === "all" || resource.status === statusFilter);
        });

        const countLabel = document.getElementById("resource-count-label");
        if (countLabel) {
            countLabel.textContent = `${filtered.length} shown · ${allResources.length} total listing${allResources.length === 1 ? "" : "s"}`;
        }

        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">⇄</div><h3>${allResources.length ? "No matching resources" : "No resources yet"}</h3><p>${allResources.length ? "Try a different search or filter." : "Be the first to share something useful with your campus community."}</p></div>`;
            return;
        }

        list.innerHTML = filtered.map((resource) => {
            const offeringLabel = {
                lend: "Available to lend",
                give: "Giving away",
                share: "Sharing information / link"
            }[resource.offering] || "Shared resource";
            const statusLabel = resource.status === "available" ? "Available" : "Marked unavailable";

            return `<article class="resource-card">
                <div class="resource-card-top">
                    <span class="resource-category-chip">${escapeHtml(resource.category)}</span>
                    <span class="resource-status ${resource.status === "available" ? "is-available" : "is-unavailable"}">${statusLabel}</span>
                </div>
                <h4>${escapeHtml(resource.title)}</h4>
                <p class="resource-description">${escapeHtml(resource.description)}</p>
                <div class="resource-meta">
                    <span>⇄ ${escapeHtml(offeringLabel)}</span>
                    <span>⌖ ${escapeHtml(resource.location)}</span>
                </div>
                <div class="resource-card-actions">
                    <button type="button" class="secondary-button" data-resource-toggle="${Number(resource.id)}">
                        ${resource.status === "available" ? "Mark unavailable" : "Mark available"}
                    </button>
                    <button type="button" class="text-button" data-resource-delete="${Number(resource.id)}">Remove</button>
                </div>
            </article>`;
        }).join("");
    } catch (error) {
        list.innerHTML = `<div class="empty-state"><h3>Resources unavailable</h3><p>${escapeHtml(error.message)} Check that the CampusBridge backend is running.</p></div>`;
        console.error("Resource loading failed:", error);
        const countLabel = document.getElementById("resource-count-label");
        if (countLabel) countLabel.textContent = "Unable to load listings";
    }
}

const resourceForm = document.getElementById("resource-form");
if (resourceForm) {
    resourceForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (resourceRequestInProgress) return;

        const message = document.getElementById("resource-form-message");
        const submitButton = resourceForm.querySelector('button[type="submit"]');
        const resource = {
            title: document.getElementById("resource-title").value.trim(),
            category: document.getElementById("resource-category").value,
            offering: document.getElementById("resource-condition").value,
            location: document.getElementById("resource-location").value.trim(),
            description: document.getElementById("resource-description").value.trim()
        };

        resourceRequestInProgress = true;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Publishing…";
        }
        message.textContent = "";
        message.className = "form-message";

        try {
            const response = await fetch(`${API_BASE}/resources`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(resource)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(resourceApiError(result, "Could not publish this resource."));

            resourceForm.reset();
            message.textContent = "Resource published successfully and saved to the CampusBridge database.";
            message.className = "form-message success";
            await renderResources();
        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";
            console.error("Resource publishing failed:", error);
        } finally {
            resourceRequestInProgress = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Publish resource";
            }
        }
    });
}

["resource-search", "resource-category-filter", "resource-status-filter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderResources);
    document.getElementById(id)?.addEventListener("change", renderResources);
});

document.addEventListener("click", async (event) => {
    const toggleButton = event.target.closest("[data-resource-toggle]");
    const deleteButton = event.target.closest("[data-resource-delete]");
    if (!toggleButton && !deleteButton) return;

    const button = toggleButton || deleteButton;
    const resourceId = Number(toggleButton
        ? toggleButton.dataset.resourceToggle
        : deleteButton.dataset.resourceDelete);

    if (!Number.isInteger(resourceId) || resourceId <= 0) return;

    if (deleteButton && !window.confirm("Remove this resource listing from the CampusBridge database?")) {
        return;
    }

    const method = deleteButton ? "DELETE" : "PATCH";
    const url = deleteButton
        ? `${API_BASE}/resources/${resourceId}`
        : `${API_BASE}/resources/${resourceId}`;
    const options = { method, headers: { "Content-Type": "application/json" } };

    if (toggleButton) {
        const current = resourcesCache.find((resource) => resource.id === resourceId);
        if (!current) return;
        options.body = JSON.stringify({
            status: current.status === "available" ? "unavailable" : "available"
        });
    }

    button.disabled = true;
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) throw new Error(resourceApiError(result, "Could not update the resource listing."));
        await renderResources();
    } catch (error) {
        alert(error.message);
        console.error("Resource update failed:", error);
    } finally {
        button.disabled = false;
    }
});

/* -----------------------------
   Start the application
----------------------------- */

setDefaultDate();
checkApiConnection();
loadReports();





async function updateMaintenanceStatus(reportId) {
    const statusSelect = document.getElementById(
        `status-${reportId}`
    );

    const selectedStatus = statusSelect.value;

    try {
        const response = await fetch(
            `${API_BASE}/maintenance/${reportId}/status`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: selectedStatus
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Could not update maintenance status."
            );
        }

        alert("Maintenance status updated successfully!");

        await loadMaintenanceData();

    } catch (error) {
        console.error("Status update failed:", error);

        alert(
            "Failed to update status. Please check whether the backend is running."
        );
    }
}