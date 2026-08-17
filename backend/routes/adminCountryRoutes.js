import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  addCountryTesterAdmin,
  createCountryAdmin,
  deleteCountryAdmin,
  getCountryAdmin,
  getCountryAnalyticsAdmin,
  listCountriesAdmin,
  removeCountryTesterAdmin,
  updateCountryAdmin,
  updateCountryConfigAdmin,
  upsertCountryPaymentMethodAdmin
} from '../controllers/countryController.js';

const router = express.Router();

router.use(protect, requireRole(['admin']));
router.get('/', listCountriesAdmin);
router.post('/', createCountryAdmin);
router.get('/:id', getCountryAdmin);
router.patch('/:id', updateCountryAdmin);
router.delete('/:id', deleteCountryAdmin);
router.patch('/:id/config', updateCountryConfigAdmin);
router.put('/:id/payments', upsertCountryPaymentMethodAdmin);
router.post('/:id/testers', addCountryTesterAdmin);
router.delete('/:id/testers/:userId', removeCountryTesterAdmin);
router.get('/:id/analytics', getCountryAnalyticsAdmin);

export default router;
