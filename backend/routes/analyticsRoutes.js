import express from 'express';
import rateLimit from 'express-rate-limit';
import { trackRealtimeMonitoringEvent } from '../controllers/realtimeAnalyticsController.js';

const router = express.Router();

const realtimeMonitoringIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(60, Number(process.env.REALTIME_MONITOR_INGEST_RATE_LIMIT_PER_MIN || 240)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Trop de signaux analytics en peu de temps. Réessayez dans une minute.'
  }
});

router.post('/realtime/events', realtimeMonitoringIngestLimiter, trackRealtimeMonitoringEvent);

export default router;
