const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Shield all admin routes with authentication and admin privilege validation
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', (req, res) => adminController.getStats(req, res));
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.put('/users/:userId/status', (req, res) => adminController.updateUserStatus(req, res));
router.get('/reports', (req, res) => adminController.getReports(req, res));
router.put('/reports/:reportId', (req, res) => adminController.updateReportStatus(req, res));
router.get('/settings', (req, res) => adminController.getSettings(req, res));
router.post('/settings', (req, res) => adminController.updateSetting(req, res));

module.exports = router;
