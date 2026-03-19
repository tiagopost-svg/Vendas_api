const express = require('express');
const {
  criarVenda,
  listarVendas,
  buscarVendaPorId,
  listarVendasPorCliente,
  atualizarVenda,
  excluirVenda,
  obterTotalVendas,
} = require('../controllers/vendasController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.post('/', criarVenda);
router.get('/', listarVendas);
router.get('/total', obterTotalVendas);
router.get('/cliente/:cliente_id', listarVendasPorCliente);
router.get('/:id', buscarVendaPorId);
router.put('/:id', atualizarVenda);
router.delete('/:id', excluirVenda);

module.exports = router;
