const pool = require('../config/db');
const { criarFollowupAutomaticoOrcamento } = require('../services/followupService');
const { criarNotificacoesVendaRecente } = require('../services/notificacaoService');

const STATUS_ORCAMENTO_VALIDOS = ['pendente', 'aprovado', 'recusado'];

const buscarClienteDaEmpresa = async (clienteId, empresaId, client = pool) => {
  const query = 'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2 LIMIT 1';
  const { rows } = await client.query(query, [clienteId, empresaId]);
  return rows[0] || null;
};

const buscarVisitaDaEmpresa = async (visitaId, empresaId, client = pool) => {
  const query = 'SELECT id, cliente_id FROM visitas WHERE id = $1 AND empresa_id = $2 LIMIT 1';
  const { rows } = await client.query(query, [visitaId, empresaId]);
  return rows[0] || null;
};

const validarDadosFiscaisCliente = (cliente) => Boolean((cliente.cpf || cliente.cnpj) && cliente.endereco_fiscal);

const resolverClienteDoOrcamento = async (empresaId, clienteId, visitaId, client = pool) => {
  let cliente = null;

  if (visitaId) {
    const visita = await buscarVisitaDaEmpresa(visitaId, empresaId, client);
    if (!visita) {
      throw new Error('Visita não encontrada para esta empresa.');
    }
    cliente = await buscarClienteDaEmpresa(visita.cliente_id, empresaId, client);
  }

  if (clienteId) {
    const clienteInformado = await buscarClienteDaEmpresa(clienteId, empresaId, client);
    if (!clienteInformado) {
      throw new Error('Cliente não encontrado para esta empresa.');
    }

    if (cliente && Number(cliente.id) !== Number(clienteInformado.id)) {
      throw new Error('A visita selecionada pertence a outro cliente.');
    }

    cliente = clienteInformado;
  }

  if (!cliente) {
    throw new Error('Informe um cliente_id válido ou selecione uma visita vinculada.');
  }

  return cliente;
};

const listarOrcamentos = async (req, res) => {
  const { status, cliente_id } = req.query;

  try {
    const filtros = ['o.empresa_id = $1'];
    const valores = [req.user.empresa_id];

    if (status) {
      filtros.push(`o.status = $${valores.length + 1}`);
      valores.push(status);
    }

    if (cliente_id) {
      filtros.push(`o.cliente_id = $${valores.length + 1}`);
      valores.push(cliente_id);
    }

    const query = `
      SELECT o.*, c.nome AS cliente_nome
      FROM orcamentos o
      INNER JOIN clientes c ON c.id = o.cliente_id AND c.empresa_id = o.empresa_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY o.data_criacao DESC, o.id DESC
    `;
    const { rows } = await pool.query(query, valores);
    return res.status(200).json({ sucesso: true, dados: rows });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const buscarOrcamentoPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT o.*, c.nome AS cliente_nome
      FROM orcamentos o
      INNER JOIN clientes c ON c.id = o.cliente_id AND c.empresa_id = o.empresa_id
      WHERE o.id = $1 AND o.empresa_id = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Orçamento não encontrado para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const criarOrcamento = async (req, res) => {
  const { cliente_id, visita_id, descricao, valor, status, data_validade } = req.body;

  if (!descricao || valor === undefined || !status || !data_validade) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'descricao, valor, status e data_validade são obrigatórios.',
    });
  }

  if (!STATUS_ORCAMENTO_VALIDOS.includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status do orçamento inválido.' });
  }

  try {
    const cliente = await resolverClienteDoOrcamento(req.user.empresa_id, cliente_id, visita_id);

    const query = `
      INSERT INTO orcamentos (empresa_id, cliente_id, visita_id, descricao, valor, status, data_validade)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [req.user.empresa_id, cliente.id, visita_id || null, descricao, valor, status, data_validade];
    const { rows } = await pool.query(query, values);

    await criarFollowupAutomaticoOrcamento({
      empresaId: req.user.empresa_id,
      clienteId: cliente.id,
      orcamentoId: rows[0].id,
      responsavelId: req.user.id,
    });

    return res.status(201).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(400).json({ sucesso: false, mensagem: error.message });
  }
};

const atualizarOrcamento = async (req, res) => {
  const { id } = req.params;
  const { cliente_id, visita_id, descricao, valor, status, data_validade } = req.body;

  if (!descricao || valor === undefined || !status || !data_validade) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'descricao, valor, status e data_validade são obrigatórios.',
    });
  }

  if (!STATUS_ORCAMENTO_VALIDOS.includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status do orçamento inválido.' });
  }

  try {
    const cliente = await resolverClienteDoOrcamento(req.user.empresa_id, cliente_id, visita_id);

    const query = `
      UPDATE orcamentos
      SET cliente_id = $1,
          visita_id = $2,
          descricao = $3,
          valor = $4,
          status = $5,
          data_validade = $6,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $7 AND empresa_id = $8
      RETURNING *
    `;
    const values = [cliente.id, visita_id || null, descricao, valor, status, data_validade, id, req.user.empresa_id];
    const { rows } = await pool.query(query, values);

    if (status !== 'pendente' && rows.length > 0) {
      await pool.query(
        "UPDATE follow_ups SET status = 'cancelado' WHERE empresa_id = $1 AND tipo = 'orcamento' AND referencia_id = $2 AND status = 'pendente'",
        [req.user.empresa_id, id],
      );
    }

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Orçamento não encontrado para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(400).json({ sucesso: false, mensagem: error.message });
  }
};

const excluirOrcamento = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM orcamentos WHERE id = $1 AND empresa_id = $2 RETURNING id, cliente_id';
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Orçamento não encontrado para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, mensagem: 'Orçamento excluído com sucesso.', dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const converterOrcamentoEmVenda = async (req, res) => {
  const { id } = req.params;
  const { forma_pagamento, data_venda } = req.body;

  if (!forma_pagamento || !data_venda) {
    return res.status(400).json({ sucesso: false, mensagem: 'forma_pagamento e data_venda são obrigatórios.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const queryOrcamento = `
      SELECT *
      FROM orcamentos
      WHERE id = $1 AND empresa_id = $2
      LIMIT 1
    `;
    const orcamentoResult = await client.query(queryOrcamento, [id, req.user.empresa_id]);

    if (orcamentoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ sucesso: false, mensagem: 'Orçamento não encontrado para esta empresa.' });
    }

    const orcamento = orcamentoResult.rows[0];
    const cliente = await buscarClienteDaEmpresa(orcamento.cliente_id, req.user.empresa_id, client);

    if (!validarDadosFiscaisCliente(cliente)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ sucesso: false, mensagem: 'Preencha os dados fiscais para concluir a venda' });
    }

    const vendaExistente = await client.query(
      'SELECT id FROM vendas WHERE orcamento_id = $1 AND empresa_id = $2 LIMIT 1',
      [orcamento.id, req.user.empresa_id],
    );

    if (vendaExistente.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ sucesso: false, mensagem: 'Este orçamento já foi convertido em venda.' });
    }

    const vendaResult = await client.query(
      `
        INSERT INTO vendas (empresa_id, cliente_id, orcamento_id, valor, status, forma_pagamento, data_venda)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [req.user.empresa_id, orcamento.cliente_id, orcamento.id, orcamento.valor, 'em_andamento', forma_pagamento, data_venda],
    );

    const orcamentoAtualizado = await client.query(
      `
        UPDATE orcamentos
        SET status = 'aprovado'
        WHERE id = $1 AND empresa_id = $2
        RETURNING *
      `,
      [orcamento.id, req.user.empresa_id],
    );

    await client.query(
      "UPDATE follow_ups SET status = 'cancelado' WHERE empresa_id = $1 AND tipo = 'orcamento' AND referencia_id = $2 AND status = 'pendente'",
      [req.user.empresa_id, orcamento.id],
    );

    await client.query('COMMIT');

    await criarNotificacoesVendaRecente({
      empresaId: req.user.empresa_id,
      vendaId: vendaResult.rows[0].id,
      clienteNome: cliente.nome,
      valor: vendaResult.rows[0].valor,
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Orçamento convertido em venda com sucesso.',
      dados: {
        orcamento: orcamentoAtualizado.rows[0],
        venda: vendaResult.rows[0],
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listarOrcamentos,
  buscarOrcamentoPorId,
  criarOrcamento,
  atualizarOrcamento,
  excluirOrcamento,
  converterOrcamentoEmVenda,
};
