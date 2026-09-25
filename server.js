import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './src/db.js';
import authRoutes from './src/routes/authRoutes.js';
import recordRoutes from './src/routes/recordRoutes.js';
import auditRoutes from './src/routes/auditRoutes.js';
import userRoutes from './src/routes/userRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api/auth', authRoutes);
  app.use('/api/records', recordRoutes);
  app.use('/api/audit-trail', auditRoutes);
  app.use('/api/users', userRoutes);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'operational',
      application: 'Compliant Records',
      specification: '21 CFR Part 11 / GAMP 5',
      author: 'Dhruv Mehta',
      version: '1.0.0'
    });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

// Start server
initDatabase();
const app = createApp();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('  Compliant Records - 21 CFR Part 11 Data Integrity Demo');
  console.log('  Author: Dhruv Mehta');
  console.log('  Server running at: http://localhost:' + PORT);
  console.log('================================================================');
});