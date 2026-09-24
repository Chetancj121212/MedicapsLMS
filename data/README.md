# Runtime Data

This directory is the single local runtime-data location for the LMS.

- `lms.db` contains the local SQLite database.
- `uploads/` contains uploaded course videos.
- `certificates/` contains generated certificate PDFs and QR images.

The backend resolves these paths through `backend/.env` and does not store runtime files inside the backend source tree.

Runtime files are ignored by Git. Keep only this README and `.gitkeep` tracked.
