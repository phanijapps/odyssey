# Manual QA: curriculum ingestion

1. Start the app with `pnpm --filter child-math-app dev` and open `/ingestion`.
2. Select a non-empty `.txt`, `.csv`, `.json`, or `.pdf` file and choose **Upload source**.
3. Confirm the file name, type, size, and Bronze status appear without raw file
   contents.
4. Choose **Approve Bronze**, then **Generate Silver**. With local Pi/Ollama
   configured, confirm a source summary and extracted-record count appear.
5. Choose **Approve Silver**, then **Generate Gold**. Confirm the terminal
   result reports SQLite-Vec record count and Engram projection status.
6. Refresh the completed workflow URL indirectly by returning to `/ingestion`;
   the temporary Bronze/Silver workflow must no longer be available.

## Observed local smoke

- `POST /api/curriculum/ingestions` with `app/package.json` as JSON returned
  `201`, a new workflow identifier, and `stage: bronze`.
- `approve-bronze` for that workflow returned `200` and
  `stage: bronze-approved`.
- `pnpm --filter child-math-app build` completed and listed the ingestion page
  plus all three curriculum API routes.
