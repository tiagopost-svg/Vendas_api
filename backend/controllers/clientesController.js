const pool = require('../config/db');
const { montarTimelineCliente } = require('../services/timelineService');

const TIPOS_VALIDOS = ['residencial', 'comercial'];
const STATUS_VALIDOS = ['lead', 'contato', 'visita', 'orcamento', 'negociacao', 'venda'];

const parseNumeroPositivo = (valor, fallback) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : fallback;
};

const normalizarPayloadCliente = (body) => ({
  nome: body.nome,
  telefone: body.telefone || null,
  email: body.email || null,
  cidade: body.cidade || null,
  endereco: body.endereco || null,
  endereco_fiscal: body.endereco_fiscal || null,
  cpf: body.cpf || null,
  cnpj: body.cnpj || null,
  tipo: body.tipo || 'residencial',
  origem_lead: body.origem_lead || null,
  status_pipeline: body.status_pipeline || 'lead',
  observacoes: body.observacoes || null,
});

const validarCliente = (cliente) => {
  if (!cliente.nome) {
    return 'Nome é obrigatório.';
  }

  if (!TIPOS_VALIDOS.includes(cliente.tipo)) {
    return 'Tipo inválido. Use residencial ou comercial.';
  }

  if (!STATUS_VALIDOS.includes(cliente.status_pipeline)) {
    return 'status_pipeline inválido.';
  }

  return null;
};

const montarFiltroClientes = (req) => {
  const { busca, status, page = 1, limit = 10, order = 'desc' } = req.query;
  const limitValue = parseNumeroPositivo(limit, 10);
  const pageValue = parseNumeroPositivo(page, 1);
  const offsetValue = (pageValue - 1) * limitValue;
  const orderValue = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const filtros = ['empresa_id = $1'];
  const valores = [req.user.empresa_id];

  if (busca) {
    filtros.push(`nome ILIKE $${valores.length + 1}`);
    valores.push(`%${busca}%`);
  }

  if (status) {
    filtros.push(`status_pipeline = $${valores.length + 1}`);
    valores.push(status);
  }

  return {
    filtros,
    valores,
    limitValue,
    pageValue,
    offsetValue,
    orderValue,
  };
};

const listarClientes = async (req, res) => {
  try {
    const { filtros, valores, limitValue, pageValue, offsetValue, orderValue } = montarFiltroClientes(req);
    const whereClause = filtros.join(' AND ');

    const totalQuery = `SELECT COUNT(*)::INT AS total FROM clientes WHERE ${whereClause}`;
    const totalResult = await pool.query(totalQuery, valores);
    const total = totalResult.rows[0].total;

    const query = `
      SELECT *
      FROM clientes
      WHERE ${whereClause}
      ORDER BY criado_em ${orderValue}
      LIMIT $${valores.length + 1}
      OFFSET $${valores.length + 2}
    `;
    const { rows } = await pool.query(query, [...valores, limitValue, offsetValue]);

    return res.status(200).json({
      sucesso: true,
      dados: rows,
      paginacao: {
        page: pageValue,
        limit: limitValue,
        total,
        total_paginas: Math.ceil(total / limitValue) || 1,
      },
      filtros: {
        busca: req.query.busca || null,
        status: req.query.status || null,
        order: orderValue.toLowerCase(),
      },
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const buscarClientePorId = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT *
      FROM clientes
      WHERE id = $1 AND empresa_id = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const criarCliente = async (req, res) => {
  const cliente = normalizarPayloadCliente(req.body);
  const erroValidacao = validarCliente(cliente);

  if (erroValidacao) {
    return res.status(400).json({ sucesso: false, mensagem: erroValidacao });
  }

  try {
    const query = `
      INSERT INTO clientes (
        empresa_id,
        nome,
        telefone,
        email,
        cidade,
        endereco,
        endereco_fiscal,
        cpf,
        cnpj,
        tipo,
        origem_lead,
        status_pipeline,
        observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [
      req.user.empresa_id,
      cliente.nome,
      cliente.telefone,
      cliente.email,
      cliente.cidade,
      cliente.endereco,
      cliente.endereco_fiscal,
      cliente.cpf,
      cliente.cnpj,
      cliente.tipo,
      cliente.origem_lead,
      cliente.status_pipeline,
      cliente.observacoes,
    ];
    const { rows } = await pool.query(query, values);
    return res.status(201).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const atualizarCliente = async (req, res) => {
  const { id } = req.params;
  const cliente = normalizarPayloadCliente(req.body);
  const erroValidacao = validarCliente(cliente);

  if (erroValidacao) {
    return res.status(400).json({ sucesso: false, mensagem: erroValidacao });
  }

  try {
    const query = `
      UPDATE clientes
      SET nome = $1,
          telefone = $2,
          email = $3,
          cidade = $4,
          endereco = $5,
          endereco_fiscal = $6,
          cpf = $7,
          cnpj = $8,
          tipo = $9,
          origem_lead = $10,
          status_pipeline = $11,
          observacoes = $12
      WHERE id = $13 AND empresa_id = $14
      RETURNING *
    `;
    const values = [
      cliente.nome,
      cliente.telefone,
      cliente.email,
      cliente.cidade,
      cliente.endereco,
      cliente.endereco_fiscal,
      cliente.cpf,
      cliente.cnpj,
      cliente.tipo,
      cliente.origem_lead,
      cliente.status_pipeline,
      cliente.observacoes,
      id,
      req.user.empresa_id,
    ];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const obterTimelineCliente = async (req, res) => {
  const { id } = req.params;
  const { limit } = req.query;

  try {
    const dados = await montarTimelineCliente({
      empresaId: req.user.empresa_id,
      clienteId: id,
      limit,
    });

    return res.status(200).json({ sucesso: true, dados });
  } catch (error) {
    if (error.message === 'Cliente não encontrado para esta empresa.') {
      return res.status(404).json({ sucesso: false, mensagem: error.message });
    }

    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const excluirCliente = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM clientes
      WHERE id = $1 AND empresa_id = $2
      RETURNING id, nome
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado para esta empresa.' });
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Cliente excluído com sucesso.',
      dados: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  listarClientes,
  buscarClientePorId,
  criarCliente,
  atualizarCliente,
  obterTimelineCliente,
  excluirCliente,
};
