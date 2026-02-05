import { createHttpServer } from "./infra/http/express.js";
import { env } from "./config/env.js";

const { app } = createHttpServer();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on port ${env.PORT}`);
});