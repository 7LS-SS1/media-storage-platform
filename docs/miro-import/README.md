# Miro Import Pack

This folder contains CSV files for building a production rollout board for:
- Hostinger VPS
- Coolify web admin
- Neon database
- Next.js app + transcode worker

## Files

- `miro_tasks.csv`: Main execution tasks (Kanban-friendly)
- `miro_risks.csv`: Risk register
- `miro_golive_checklist.csv`: Go-live validation checklist
- `miro_architecture_nodes.csv`: Architecture nodes and flow mapping

## Recommended Frames in Miro

Create these frames first:

1. Objectives & Scope
2. Target Architecture
3. 30-Day Roadmap
4. Execution Kanban
5. Risks & Mitigation
6. Go-Live Checklist

## Import Steps

1. Open your Miro board.
2. Use CSV import (Table/Kanban/Card import app depending on your workspace setup).
3. Import each file in this folder.
4. Group/filter by `Frame` and `Lane` columns after import.
5. Convert rows to cards/sticky notes if your workflow prefers visual cards.

## Notes

- Column names are normalized for easy mapping.
- If your Miro workspace uses a different CSV importer, map fields manually using:
  - `Title` -> card title
  - `Description` -> card description
  - `Owner` -> assignee
  - `Status` -> card status
  - `Frame` -> destination frame/tag
