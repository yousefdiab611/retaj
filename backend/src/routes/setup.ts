import { Router } from "express";

import { setupController } from "../controllers/setupController";

export const setupRouter = Router();

// Public, but self-locks: `runInitialSetup` rejects with 409 once any user
// exists. This lets the desktop app reach a usable state on first launch
// without shipping a separate provisioning script.
setupRouter.get("/status", (req, res) => void setupController.getStatus(req, res));
setupRouter.post("/initial", (req, res) => void setupController.runInitialSetup(req, res));
