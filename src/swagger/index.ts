import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'KGN Construction API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
};
