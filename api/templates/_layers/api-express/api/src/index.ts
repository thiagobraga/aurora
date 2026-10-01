import { createApp } from "./app.js";
import { dbHealthy } from "./db.js";

const port = Number(process.env.PORT ?? 4000);
createApp({ dbHealthy }).listen(port, () => console.log(`api listening on :${port}`));
