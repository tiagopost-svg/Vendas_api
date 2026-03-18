const express = require('express');
const {
  listarClientes,
  buscarClientePorId,
  criarCliente,
  atualizarCliente,
  obterTimelineCliente,
  excluirCliente,
} = require('../controllers/clientesController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.get('/', listarClientes);
router.get('/:id/timeline', obterTimelineCliente);
router.get('/:id', buscarClientePorId);
router.post('/', criarCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);

module.exports = router;
