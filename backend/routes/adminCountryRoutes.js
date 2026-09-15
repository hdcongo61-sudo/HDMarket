import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireGlobalAdmin, requireRole } from '../middlewares/roleMiddleware.js';
import {
  addCountryAdminUser,
  addCountryTesterAdmin,
  createCountryAdmin,
  deleteCountryAdmin,
  getCountryAdmin,
  getCountryAdminsAdmin,
  getCountryAnalyticsAdmin,
  getCountryCommerceAdmin,
  getCountryOperationsAdmin,
  getGlobalCountriesOverviewAdmin,
  listCountriesAdmin,
  removeCountryAdminUser,
  removeCountryTesterAdmin,
  updateCountryAdmin,
  updateCountryConfigAdmin,
  upsertCountryPaymentMethodAdmin
} from '../controllers/countryController.js';

const router = express.Router();

router.use(protect, requireRole(['admin']));
router.get('/', listCountriesAdmin);
router.post('/', createCountryAdmin);
// Must be declared before '/:id' so 'global-overview' is not treated as a country id.
router.get('/global-overview', requireGlobalAdmin, getGlobalCountriesOverviewAdmin);
router.get('/:id', getCountryAdmin);
router.get('/:id/commerce', getCountryCommerceAdmin);
router.get('/:id/operations', getCountryOperationsAdmin);
router.patch('/:id', updateCountryAdmin);
router.delete('/:id', deleteCountryAdmin);
router.patch('/:id/config', updateCountryConfigAdmin);
router.put('/:id/payments', upsertCountryPaymentMethodAdmin);
router.post('/:id/testers', addCountryTesterAdmin);
router.delete('/:id/testers/:userId', removeCountryTesterAdmin);
router.get('/:id/admins', getCountryAdminsAdmin);
router.post('/:id/admins', addCountryAdminUser);
router.delete('/:id/admins/:userId', removeCountryAdminUser);
router.get('/:id/analytics', getCountryAnalyticsAdmin);

export default router;
