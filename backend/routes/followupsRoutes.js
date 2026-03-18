const express = require('express');
const {
  listarFollowups,
  criarNovoFollowup,
  atualizarFollowup,
} = require('../controllers/followupsController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.get('/', listarFollowups);
router.post('/', criarNovoFollowup);
router.put('/:id', atualizarFollowup);

module.exports = router;
