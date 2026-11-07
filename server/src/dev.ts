import { env } from "./config/env.js";
import app from "./index.js";

const port = env().PORT;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
