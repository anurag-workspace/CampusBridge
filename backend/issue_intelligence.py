import re
from itertools import combinations


# Common words that do not help much when comparing campus issue descriptions.
# This list is intentionally small so the logic remains easy to explain.
STOP_WORDS = {
    "a", "an", "and", "are", "at", "be", "been", "by", "for", "from",
    "in", "is", "it", "of", "on", "or", "our", "the", "to", "was",
    "were", "with", "near", "there", "this", "that", "has", "have",
    "not", "very", "issue", "problem", "please", "reported"
}


def normalize_text(text):
    """Lowercase text and return meaningful, unique words."""
    words = re.findall(r"\b[a-z0-9]+\b", (text or "").lower())
    return {word for word in words if word not in STOP_WORDS}


def calculate_text_similarity(text1, text2):
    """Return Jaccard word similarity as a percentage."""
    words1 = normalize_text(text1)
    words2 = normalize_text(text2)

    if not words1 and not words2:
        return 0.0

    union = words1 | words2
    if not union:
        return 0.0

    common = words1 & words2
    return round((len(common) / len(union)) * 100, 2)


def normalize_location(location):
    """Make small formatting differences in locations comparable."""
    return " ".join(re.findall(r"[a-z0-9]+", (location or "").lower()))


def normalize_category(category):
    """Normalize a category for a simple exact-match check."""
    return " ".join(re.findall(r"[a-z0-9]+", (category or "").lower()))


def analyze_issue_pair(issue1, issue2):
    """
    Compare two maintenance reports using transparent rules.

    The score is a simple heuristic for prioritizing human review, not a
    probability that the reports describe the same real-world issue.
    """
    title1 = issue1.get("title", "")
    description1 = issue1.get("description", "")
    title2 = issue2.get("title", "")
    description2 = issue2.get("description", "")

    text1 = f"{title1} {description1}"
    text2 = f"{title2} {description2}"

    text_score = calculate_text_similarity(text1, text2)

    location1 = normalize_location(issue1.get("location", ""))
    location2 = normalize_location(issue2.get("location", ""))
    same_location = bool(location1) and location1 == location2

    category1 = normalize_category(issue1.get("category", ""))
    category2 = normalize_category(issue2.get("category", ""))
    same_category = bool(category1) and category1 == category2

    # Explainable starting weights: text 50%, location 30%, category 20%.
    # These are heuristic weights and should be tuned against real examples.
    overall_score = (
        text_score * 0.50
        + (30.0 if same_location else 0.0)
        + (20.0 if same_category else 0.0)
    )
    overall_score = round(overall_score, 2)

    # Require the same location and either useful text overlap or a matching
    # category. This keeps unrelated reports at different locations apart.
    potentially_related = same_location and (
        text_score >= 15 or same_category
    )

    reasons = []
    if same_location:
        reasons.append("same normalized location")
    if same_category:
        reasons.append("same category")
    if text_score >= 15:
        reasons.append("some meaningful word overlap")
    if not reasons:
        reasons.append("no strong matching signals")

    return {
        # Keep existing keys so the current frontend can continue to render.
        "issue_1_id": issue1.get("id"),
        "issue_1_title": title1,
        "issue_1_location": issue1.get("location", ""),
        "issue_2_id": issue2.get("id"),
        "issue_2_title": title2,
        "issue_2_location": issue2.get("location", ""),
        "text_similarity": text_score,
        "same_location": same_location,
        "potentially_related": potentially_related,

        # Additional explainable signals for future UI improvements.
        "same_category": same_category,
        "overall_score": overall_score,
        "reasons": reasons,
        "review_note": "Heuristic suggestion only; verify reports before merging or acting."
    }


def find_related_issue_pairs(issues):
    """Compare each unique pair of reports and return likely related pairs."""
    related_pairs = []
    for issue1, issue2 in combinations(issues, 2):
        result = analyze_issue_pair(issue1, issue2)
        if result["potentially_related"]:
            related_pairs.append(result)

    return related_pairs
