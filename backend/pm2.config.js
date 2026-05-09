import { createApp } from './src/createApp';
import { logger } from './src/lib/logger';

const port = process.env.PORT || 3001;

const app = createApp();

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});