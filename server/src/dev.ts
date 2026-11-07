import { createApp } from "./app.js";
import { env } from "./config/env.js";

const port = env().PORT;
createApp().listen(port, () => console.log(`API running on http://localhost:${port}`));
