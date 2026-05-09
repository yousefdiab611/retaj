import { Router } from "express";

import { generateOpenApiDocument } from "../lib/openapi";

export const docsRouter = Router();

let cached: ReturnType<typeof generateOpenApiDocument> | null = null;

function getDocument() {
  if (!cached) cached = generateOpenApiDocument();
  return cached;
}

docsRouter.get("/openapi.json", (_req, res) => {
  res.json(getDocument());
});

docsRouter.get("/", (_req, res) => {
  // Minimal Swagger UI shell pulled from a CDN. For air-gapped deployments
  // swap the CDN URLs for swagger-ui-dist served statically.
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Retaj Store API — Reference</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0 }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      filter: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`);
});
