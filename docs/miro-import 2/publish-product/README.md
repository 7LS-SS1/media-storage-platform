# Miro Import: Publish Product (Vercel to VPS)

This folder contains CSV files ready for Miro import.

## Files
- `miro_publish_decision_matrix.csv`
- `miro_publish_migration_tasks.csv`
- `miro_publish_cutover_checklist.csv`
- `miro_publish_30day_plan.csv`

## Suggested Miro Frames
1. Decision Matrix
2. Migration Execution Kanban
3. Cutover Checklist
4. 30-Day Plan

## CSV Field Mapping
- `Title` => card title
- `Description` => card description
- `Owner` => assignee
- `Status` => status
- `Frame` and `Lane` => grouping labels

## Import Steps
1. Open Miro board.
2. Import each CSV using Miro CSV/Table import app.
3. Group cards by `Frame` first, then `Lane`.
4. Move statuses from `Todo` to `Done` during execution.
