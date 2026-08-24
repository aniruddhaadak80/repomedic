import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 8815);

createApp().listen(PORT, () => {
  console.log(`repomedic-tools listening on http://localhost:${PORT}/mcp`);
  console.log(
    `writes restricted to: ${process.env.REPOMEDIC_ALLOWED_REPOS || "(none — writes disabled)"}`,
  );
});
