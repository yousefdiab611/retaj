import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';

const customerRouter = Router();

customerRouter.use(requireAuth);

// Customer self-service
customerRouter.get('/profile', async (req, res) => {
  // Get customer profile
});

customerRouter.put('/profile', async (req, res) => {
  // Update profile
});

customerRouter.get('/subscription', async (req, res) => {
  // Get subscription
});

customerRouter.post('/support', async (req, res) => {
  // Submit support request
});

export { customerRouter };