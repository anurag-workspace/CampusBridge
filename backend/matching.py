import re
from datetime import date


def get_words(text):
    """Convert text into a set of lowercase words."""
    text = text.lower()
    words = re.findall(r"\b[a-z0-9]+\b", text)
    return set(words)


def calculate_similarity(text1, text2):
    """Calculate Jaccard similarity between two texts."""

    words1 = get_words(text1)
    words2 = get_words(text2)

    if not words1 and not words2:
        return 0.0

    common_words = words1.intersection(words2)
    all_words = words1.union(words2)

    similarity = len(common_words) / len(all_words)

    return round(similarity * 100, 2)


def calculate_date_score(date1, date2):
    """
    Give higher scores to reports with closer dates.

    Reports on the same day receive 100.
    The score decreases as the date difference increases.
    """

    difference = abs((date1 - date2).days)

    score = max(0, 100 - (difference * 10))

    return score


def calculate_match_score(
    item_name1,
    description1,
    category1,
    location1,
    date1,
    item_name2,
    description2,
    category2,
    location2,
    date2
):
    """Calculate an explainable score for two item reports."""

    # 1. Compare item names.
    name_score = calculate_similarity(
        item_name1,
        item_name2
    )

    # 2. Compare descriptions.
    description_score = calculate_similarity(
        description1,
        description2
    )

    # 3. Compare categories.
    category_score = (
        100
        if category1.strip().lower() == category2.strip().lower()
        else 0
    )

    # 4. Compare locations.
    location_score = (
        100
        if location1.strip().lower() == location2.strip().lower()
        else 0
    )

    # 5. Compare dates.
    date_score = calculate_date_score(date1, date2)

    # Combine all five signals.
    final_score = (
        name_score * 0.35
        + description_score * 0.25
        + category_score * 0.15
        + location_score * 0.15
        + date_score * 0.10
    )

    # Explain why the reports may match.
    reasons = []

    if name_score >= 50:
        reasons.append("Similar item names")

    if description_score >= 30:
        reasons.append("Similar descriptions")

    if category_score == 100:
        reasons.append("Same item category")

    if location_score == 100:
        reasons.append("Same reported location")

    if date_score >= 80:
        reasons.append("Reported dates are close")

    return {
        "similarity_score": round(final_score, 2),
        "name_score": name_score,
        "description_score": description_score,
        "category_score": category_score,
        "location_score": location_score,
        "date_score": date_score,
        "reasons": reasons,
        "note": (
            "This score ranks possible matches; "
            "it is not a probability of item identity. "
            "Human verification is required."
        )
    }


if __name__ == "__main__":

    result = calculate_match_score(
        item_name1="Laptop Charger",
        description1="Black laptop charger with a white label",
        category1="Electronics",
        location1="Library",
        date1=date(2026, 10, 15),

        item_name2="Laptop charger",
        description2="Black laptop charger with a white sticker",
        category2="Electronics",
        location2="Library",
        date2=date(2026, 10, 15)
    )

    print("MATCHING ALGORITHM TEST")
    print("-" * 35)

    for key, value in result.items():
        print(f"{key}: {value}")