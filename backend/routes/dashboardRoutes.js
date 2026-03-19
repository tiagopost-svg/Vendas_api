const express = require('express');
const { obterDashboard } = require('../controllers/dashboardController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.get('/', obterDashboard);

module.exports = router;
