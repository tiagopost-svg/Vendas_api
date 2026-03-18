const pool = require('../config/db');
const { criarNotificacoesVendaRecente } = require('../services/notificacaoService');

const STATUS_VENDA_VALIDOS = ['em_andamento', 'fechado'];

const buscarClienteDaEmpresa = async (clienteId, empresaId) => {
  const query = 'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2 LIMIT 1';
  const { rows } = await pool.query(query, [clienteId, empresaId]);
  return rows[0] || null;
};

const validarDadosFiscaisCliente = (cliente) => Boolean((cliente.cpf || cliente.cnpj) && cliente.endereco_fiscal);

const listarVendas = async (req, res) => {
  const { status } = req.query;

  try {
    const filtros = ['v.empresa_id = $1'];
    const valores = [req.user.empresa_id];

    if (status) {
      filtros.push(`v.status = $${valores.length + 1}`);
      valores.push(status);
    }

    const query = `
      SELECT v.*, c.nome AS cliente_nome
      FROM vendas v
      INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY v.data_venda DESC, v.id DESC
    `;
    const { rows } = await pool.query(query, valores);
    return res.status(200).json({ sucesso: true, dados: rows });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const buscarVendaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT v.*, c.nome AS cliente_nome
      FROM vendas v
      INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
      WHERE v.id = $1 AND v.empresa_id = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Venda não encontrada para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const listarVendasPorCliente = async (req, res) => {
  const { cliente_id } = req.params;

  try {
    const cliente = await buscarClienteDaEmpresa(cliente_id, req.user.empresa_id);

    if (!cliente) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado para esta empresa.' });
    }

    const query = `
      SELECT v.*, c.nome AS cliente_nome
      FROM vendas v
      INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
      WHERE v.empresa_id = $1 AND v.cliente_id = $2
      ORDER BY v.data_venda DESC, v.id DESC
    `;
    const { rows } = await pool.query(query, [req.user.empresa_id, cliente_id]);
    return res.status(200).json({ sucesso: true, dados: rows });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const criarVenda = async (req, res) => {
  const { cliente_id, orcamento_id, valor, status, forma_pagamento, data_venda } = req.body;

  if (!cliente_id || valor === undefined || !status || !forma_pagamento || !data_venda) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'cliente_id, valor, status, forma_pagamento e data_venda são obrigatórios.',
    });
  }

  if (!STATUS_VENDA_VALIDOS.includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status da venda inválido.' });
  }

  try {
    const cliente = await buscarClienteDaEmpresa(cliente_id, req.user.empresa_id);

    if (!cliente) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O cliente informado não pertence à empresa do usuário logado.',
      });
    }

    if (!validarDadosFiscaisCliente(cliente)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha os dados fiscais para concluir a venda' });
    }

    const query = `
      INSERT INTO vendas (empresa_id, cliente_id, orcamento_id, valor, status, forma_pagamento, data_venda)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [req.user.empresa_id, cliente_id, orcamento_id || null, valor, status, forma_pagamento, data_venda];
    const { rows } = await pool.query(query, values);
    await criarNotificacoesVendaRecente({
      empresaId: req.user.empresa_id,
      vendaId: rows[0].id,
      clienteNome: cliente.nome,
      valor: rows[0].valor,
    });
    return res.status(201).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const atualizarVenda = async (req, res) => {
  const { id } = req.params;
  const { cliente_id, orcamento_id, valor, status, forma_pagamento, data_venda } = req.body;

  if (!cliente_id || valor === undefined || !status || !forma_pagamento || !data_venda) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'cliente_id, valor, status, forma_pagamento e data_venda são obrigatórios.',
    });
  }

  if (!STATUS_VENDA_VALIDOS.includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status da venda inválido.' });
  }

  try {
    const cliente = await buscarClienteDaEmpresa(cliente_id, req.user.empresa_id);

    if (!cliente) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O cliente informado não pertence à empresa do usuário logado.',
      });
    }

    if (!validarDadosFiscaisCliente(cliente)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha os dados fiscais para concluir a venda' });
    }

    const query = `
      UPDATE vendas
      SET cliente_id = $1,
          orcamento_id = $2,
          valor = $3,
          status = $4,
          forma_pagamento = $5,
          data_venda = $6
      WHERE id = $7 AND empresa_id = $8
      RETURNING *
    `;
    const values = [cliente_id, orcamento_id || null, valor, status, forma_pagamento, data_venda, id, req.user.empresa_id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Venda não encontrada para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const excluirVenda = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM vendas
      WHERE id = $1 AND empresa_id = $2
      RETURNING id, cliente_id, valor
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Venda não encontrada para esta empresa.' });
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Venda excluída com sucesso.',
      dados: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const obterTotalVendas = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(*)::INT AS quantidade_vendas,
             COALESCE(SUM(valor), 0)::NUMERIC(12, 2) AS total_vendas
      FROM vendas
      WHERE empresa_id = $1
    `;
    const { rows } = await pool.query(query, [req.user.empresa_id]);
    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  criarVenda,
  listarVendas,
  buscarVendaPorId,
  listarVendasPorCliente,
  atualizarVenda,
  excluirVenda,
  obterTotalVendas,
};
