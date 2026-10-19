CampusBridge — Resource Exchange Backend Integration
=====================================================

Files included:
- main.py
- database.py
- init_db.py
- script.js

What changed:
- Resource Exchange listings now use the FastAPI backend and SQLite table `resource_listings`.
- Added GET /resources, POST /resources, PATCH /resources/{resource_id}, DELETE /resources/{resource_id}.
- Resource listing availability and deletion persist in the database.
- Search and filters work against API-loaded data.
- Existing browser-only Resource Exchange listings are imported to the backend on first opening Resource Exchange where possible.
- The backend safely creates missing tables at startup using CREATE TABLE IF NOT EXISTS.
- The existing item_reports and maintenance_reports tables and records are preserved.

Install steps:
1. Stop the backend server with Ctrl+C in its terminal.
2. Make a backup copy of these current files:
   backend/main.py
   backend/database.py
   backend/init_db.py
   frontend/script.js
3. Extract this ZIP.
4. Copy the included main.py, database.py, init_db.py into:
   A:\INNOTECH 2K26\CampusBridge\backend\
5. Copy the included script.js into:
   A:\INNOTECH 2K26\CampusBridge\frontend\
6. Do not delete campusbridge.db and do not manually delete localStorage.
7. Restart the backend:
   cd /d "A:\INNOTECH 2K26\CampusBridge"
   .venv\Scripts\activate.bat
   python -m uvicorn main:app --reload --app-dir backend
8. Keep/start the frontend server as before and open your existing CampusBridge URL.
9. Open Resource Exchange. The backend will create the new table automatically; legacy browser listings will be imported if valid.
10. Test publishing, refresh, search/filter, mark unavailable/available, and remove. Then open Resource Exchange in a second browser on the same computer to confirm listings come from the backend.

Safety:
- The database initializer uses CREATE TABLE IF NOT EXISTS and does not drop tables or delete existing rows.
- A backup is still recommended before replacing project files.
- Existing browser-local resources are migrated one by one. If an import fails, remaining items are kept in localStorage for a later retry.
- Other devices can access the same listings only if they can reach the same backend over the network or through deployment. The current API_BASE is localhost, which is local to the device running the browser.
