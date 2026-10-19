from issue_intelligence import analyze_issue_pair

from datetime import date, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import get_connection
from init_db import initialize_database

app = FastAPI(
    title="CampusBridge API",
    description="A smart campus community and resource intelligence platform.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


# Define the structure of an item report
class ItemReportCreate(BaseModel):
    report_type: str = Field(pattern="^(lost|found)$")
    item_name: str = Field(min_length=2, max_length=100)
    category: str = Field(min_length=2, max_length=50)
    description: str = Field(min_length=5, max_length=1000)
    location: str = Field(min_length=2, max_length=200)
    report_date: date


class MaintenanceReportCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=2000)
    category: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    severity: str = Field(pattern="^(low|medium|high)$")


class MaintenanceStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|in_progress|resolved)$")


class ResourceCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    category: str = Field(min_length=2, max_length=60)
    offering: str = Field(pattern="^(lend|give|share)$")
    location: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=5, max_length=1000)


class ResourceStatusUpdate(BaseModel):
    status: str = Field(pattern="^(available|unavailable)$")


@app.on_event("startup")
def startup_initialize_database():
    # Safe: CREATE TABLE IF NOT EXISTS preserves existing records.
    initialize_database()


@app.get("/")
def home():
    return {
        "project": "CampusBridge",
        "message": "Welcome to CampusBridge!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/items")
def create_item_report(report: ItemReportCreate):
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO item_reports (
                report_type,
                item_name,
                category,
                description,
                location,
                report_date
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                report.report_type,
                report.item_name,
                report.category,
                report.description,
                report.location,
                report.report_date.isoformat(),
            ),
        )

        connection.commit()

        return {
            "message": "Item report created successfully!",
            "report_id": cursor.lastrowid,
        }

    except Exception:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Could not save the item report.")

    finally:
        connection.close()


@app.get("/items")
def get_item_reports():
    connection = get_connection()

    try:
        rows = connection.execute("""
            SELECT *
            FROM item_reports
            ORDER BY id DESC
            """).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


from matching import calculate_match_score


@app.get("/items/{item_id}/matches")
def find_item_matches(item_id: int):
    connection = get_connection()

    try:
        # Find the item report requested by the user
        target = connection.execute(
            """
            SELECT *
            FROM item_reports
            WHERE id = ?
            """,
            (item_id,),
        ).fetchone()

        if target is None:
            raise HTTPException(status_code=404, detail="Item report not found.")

        # Find reports of the opposite type
        opposite_type = "found" if target["report_type"] == "lost" else "lost"

        candidates = connection.execute(
            """
            SELECT *
            FROM item_reports
            WHERE report_type = ?
              AND status = 'open'
              AND id != ?
            """,
            (opposite_type, item_id),
        ).fetchall()

        matches = []

        for candidate in candidates:
            result = calculate_match_score(
                item_name1=target["item_name"],
                description1=target["description"],
                category1=target["category"],
                location1=target["location"],
                date1=date.fromisoformat(target["report_date"]),
                item_name2=candidate["item_name"],
                description2=candidate["description"],
                category2=candidate["category"],
                location2=candidate["location"],
                date2=date.fromisoformat(candidate["report_date"]),
            )

            score = result["similarity_score"]

            if score >= 30:
                matches.append(
                    {
                        "report_id": candidate["id"],
                        "report_type": candidate["report_type"],
                        "item_name": candidate["item_name"],
                        "category": candidate["category"],
                        "description": candidate["description"],
                        "location": candidate["location"],
                        **result,
                    }
                )

        matches.sort(key=lambda match: match["similarity_score"], reverse=True)

        return {
            "searched_report_id": item_id,
            "searched_item": target["item_name"],
            "possible_matches": matches,
        }

    finally:
        connection.close()


@app.post("/maintenance")
def create_maintenance_report(report: MaintenanceReportCreate):
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO maintenance_reports (
                title,
                description,
                category,
                location,
                severity
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                report.title,
                report.description,
                report.category,
                report.location,
                report.severity,
            ),
        )

        connection.commit()

        return {
            "message": "Maintenance report created successfully!",
            "report_id": cursor.lastrowid,
        }

    except Exception:
        connection.rollback()
        raise HTTPException(
            status_code=500, detail="Could not save the maintenance report."
        )

    finally:
        connection.close()


@app.get("/maintenance")
def get_maintenance_reports():
    connection = get_connection()

    try:
        rows = connection.execute("""
            SELECT *
            FROM maintenance_reports
            ORDER BY
    CASE
        WHEN status = 'resolved' THEN 1
        ELSE 0
    END,
    CASE severity
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
    END,
    id DESC
            """).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()


@app.get("/maintenance/intelligence")
def get_maintenance_intelligence():
    connection = get_connection()

    try:
        rows = connection.execute("""
            SELECT *
            FROM maintenance_reports
            ORDER BY id DESC
            """).fetchall()

        issues = [dict(row) for row in rows]

        related_pairs = []

        for i in range(len(issues)):
            for j in range(i + 1, len(issues)):
                result = analyze_issue_pair(issues[i], issues[j])

                if result["potentially_related"]:
                    related_pairs.append(result)

        return {
            "total_reports": len(issues),
            "related_pairs_found": len(related_pairs),
            "related_pairs": related_pairs,
        }

    finally:
        connection.close()


@app.patch("/maintenance/{report_id}/status")
def update_maintenance_status(report_id: int, update: MaintenanceStatusUpdate):
    connection = get_connection()

    try:
        existing_report = connection.execute(
            """
            SELECT id
            FROM maintenance_reports
            WHERE id = ?
            """,
            (report_id,),
        ).fetchone()

        if existing_report is None:
            raise HTTPException(status_code=404, detail="Maintenance report not found.")

        connection.execute(
            """
            UPDATE maintenance_reports
            SET status = ?
            WHERE id = ?
            """,
            (update.status, report_id),
        )

        connection.commit()

        return {
            "message": "Maintenance status updated successfully.",
            "report_id": report_id,
            "status": update.status,
        }

    except HTTPException:
        raise

    except Exception:
        connection.rollback()

        raise HTTPException(
            status_code=500, detail="Could not update maintenance status."
        )

    finally:
        connection.close()



# Campus Resource Exchange
@app.get("/resources")
def get_resources():
    connection = get_connection()
    try:
        rows = connection.execute("""
            SELECT id, title, category, offering, location, description,
                   status, created_at
            FROM resource_listings
            ORDER BY id DESC
        """).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


@app.post("/resources", status_code=201)
def create_resource(resource: ResourceCreate):
    connection = get_connection()
    try:
        cursor = connection.execute("""
            INSERT INTO resource_listings (
                title, category, offering, location, description
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            resource.title.strip(),
            resource.category.strip(),
            resource.offering,
            resource.location.strip(),
            resource.description.strip(),
        ))
        connection.commit()
        row = connection.execute(
            "SELECT id, title, category, offering, location, description, status, created_at "
            "FROM resource_listings WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return dict(row)
    except Exception:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Could not save the resource listing.")
    finally:
        connection.close()


@app.patch("/resources/{resource_id}")
def update_resource_status(resource_id: int, update: ResourceStatusUpdate):
    connection = get_connection()
    try:
        cursor = connection.execute(
            "UPDATE resource_listings SET status = ? WHERE id = ?",
            (update.status, resource_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Resource listing not found.")
        connection.commit()
        row = connection.execute(
            "SELECT id, title, category, offering, location, description, status, created_at "
            "FROM resource_listings WHERE id = ?",
            (resource_id,),
        ).fetchone()
        return dict(row)
    except HTTPException:
        raise
    except Exception:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Could not update the resource listing.")
    finally:
        connection.close()


@app.delete("/resources/{resource_id}")
def delete_resource(resource_id: int):
    connection = get_connection()
    try:
        cursor = connection.execute(
            "DELETE FROM resource_listings WHERE id = ?",
            (resource_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Resource listing not found.")
        connection.commit()
        return {"message": "Resource listing deleted successfully.", "resource_id": resource_id}
    except HTTPException:
        raise
    except Exception:
        connection.rollback()
        raise HTTPException(status_code=500, detail="Could not delete the resource listing.")
    finally:
        connection.close()
