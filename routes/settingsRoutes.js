const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/change-password', (req, res) => settingsController.changePassword(req, res));
router.get('/notifications', (req, res) => settingsController.getNotifications(req, res));
router.post('/notifications/read', (req, res) => settingsController.markNotificationsRead(req, res));

module.exports = router;
