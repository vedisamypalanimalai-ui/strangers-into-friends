const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', (req, res) => friendController.getFriends(req, res));
router.get('/requests', (req, res) => friendController.getFriendRequests(req, res));
router.post('/requests', (req, res) => friendController.sendFriendRequest(req, res));
router.post('/requests/respond', (req, res) => friendController.respondFriendRequest(req, res));
router.post('/remove', (req, res) => friendController.removeFriend(req, res));

// Blocks & Reports
router.get('/blocked', (req, res) => friendController.getBlockedUsers(req, res));
router.post('/block', (req, res) => friendController.blockUser(req, res));
router.post('/unblock', (req, res) => friendController.unblockUser(req, res));
router.post('/report', (req, res) => friendController.reportUser(req, res));

module.exports = router;
