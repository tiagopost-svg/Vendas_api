const pool = require('../config/db');

const TIPOS_VALIDOS = ['followup', 'visita', 'venda', 'sistema'];
const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta'];
const REFERENCIAS_VALIDAS = ['cliente', 'visita', 'orcamento', 'venda', 'followup', 'sistema'];

const parseNumeroPositivo = (valor, fallback) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : fallback;
};

const validarPayloadNotificacao = ({ tipo, titulo, mensagem, prioridade, referenciaTipo }) => {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error('Tipo de notificação inválido.');
  }

  if (!titulo || !mensagem) {
    throw new Error('titulo e mensagem são obrigatórios.');
  }

  if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
    throw new Error('Prioridade inválida.');
  }

  if (!REFERENCIAS_VALIDAS.includes(referenciaTipo)) {
    throw new Error('Tipo de referência inválido.');
  }
};

const buscarUsuariosDaEmpresa = async (empresaId, client = pool) => {
  const { rows } = await client.query(
    `
      SELECT id, nome, nivel
      FROM usuarios
      WHERE empresa_id = $1
      ORDER BY CASE WHEN nivel = 'admin' THEN 0 ELSE 1 END, id ASC
    `,
    [empresaId],
  );

  return rows;
};

const existeNotificacaoSemelhante = async ({
  empresaId,
  usuarioId,
  tipo,
  titulo,
  referenciaId,
  referenciaTipo,
}, client = pool) => {
  const { rows } = await client.query(
    `
      SELECT id
      FROM notificacoes
      WHERE empresa_id = $1
        AND usuario_id = $2
        AND tipo = $3
        AND titulo = $4
        AND referencia_tipo = $5
        AND COALESCE(referencia_id, 0) = COALESCE($6, 0)
        AND (
          lida = false
          OR data_criacao >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )
      LIMIT 1
    `,
    [empresaId, usuarioId, tipo, titulo, referenciaTipo, referenciaId || null],
  );

  return rows[0] || null;
};

const criarNotificacao = async ({
  empresaId,
  usuarioId,
  tipo,
  titulo,
  mensagem,
  referenciaId = null,
  referenciaTipo = 'sistema',
  prioridade = 'media',
}, client = pool) => {
  validarPayloadNotificacao({ tipo, titulo, mensagem, prioridade, referenciaTipo });

  const existente = await existeNotificacaoSemelhante({
    empresaId,
    usuarioId,
    tipo,
    titulo,
    referenciaId,
    referenciaTipo,
  }, client);

  if (existente) {
    return null;
  }

  const { rows } = await client.query(
    `
      INSERT INTO notificacoes (
        empresa_id,
        usuario_id,
        tipo,
        titulo,
        mensagem,
        referencia_id,
        referencia_tipo,
        lida,
        prioridade
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
      RETURNING *
    `,
    [empresaId, usuarioId, tipo, titulo, mensagem, referenciaId, referenciaTipo, prioridade],
  );

  return rows[0];
};

const criarNotificacoesParaUsuarios = async ({
  empresaId,
  usuarios,
  tipo,
  titulo,
  mensagem,
  referenciaId = null,
  referenciaTipo = 'sistema',
  prioridade = 'media',
}, client = pool) => {
  const listaUsuarios = usuarios?.length ? usuarios : await buscarUsuariosDaEmpresa(empresaId, client);
  const resultados = await Promise.all(
    listaUsuarios.map((usuario) => criarNotificacao({
      empresaId,
      usuarioId: usuario.id,
      tipo,
      titulo,
      mensagem,
      referenciaId,
      referenciaTipo,
      prioridade,
    }, client)),
  );

  return resultados.filter(Boolean);
};

const listarNotificacoesDoUsuario = async ({ empresaId, usuarioId, limit = 20, somenteNaoLidas = false }) => {
  const filtros = ['n.empresa_id = $1', 'n.usuario_id = $2'];
  const valores = [empresaId, usuarioId];

  if (somenteNaoLidas) {
    filtros.push('n.lida = false');
  }

  const limite = parseNumeroPositivo(limit, 20);
  valores.push(limite);

  const { rows } = await pool.query(
    `
      SELECT
        n.*,
        CASE
          WHEN n.referencia_tipo = 'cliente' THEN 'cliente'
          WHEN n.referencia_tipo = 'visita' THEN 'visita'
          WHEN n.referencia_tipo = 'orcamento' THEN 'orcamento'
          WHEN n.referencia_tipo = 'venda' THEN 'cliente'
          WHEN n.referencia_tipo = 'followup' THEN 'cliente'
          ELSE 'sistema'
        END AS destino_tipo,
        CASE
          WHEN n.referencia_tipo = 'cliente' THEN n.referencia_id
          WHEN n.referencia_tipo = 'visita' THEN n.referencia_id
          WHEN n.referencia_tipo = 'orcamento' THEN n.referencia_id
          WHEN n.referencia_tipo = 'venda' THEN v.cliente_id
          WHEN n.referencia_tipo = 'followup' THEN f.cliente_id
          ELSE n.referencia_id
        END AS destino_id,
        c.nome AS cliente_nome,
        v.cliente_id AS venda_cliente_id,
        f.cliente_id AS followup_cliente_id
      FROM notificacoes n
      LEFT JOIN vendas v
        ON n.referencia_tipo = 'venda'
       AND v.id = n.referencia_id
       AND v.empresa_id = n.empresa_id
      LEFT JOIN follow_ups f
        ON n.referencia_tipo = 'followup'
       AND f.id = n.referencia_id
       AND f.empresa_id = n.empresa_id
      LEFT JOIN clientes c
        ON c.empresa_id = n.empresa_id
       AND c.id = CASE
         WHEN n.referencia_tipo = 'cliente' THEN n.referencia_id
         WHEN n.referencia_tipo = 'venda' THEN v.cliente_id
         WHEN n.referencia_tipo = 'followup' THEN f.cliente_id
         ELSE NULL
       END
      WHERE ${filtros.join(' AND ')}
      ORDER BY
        n.lida ASC,
        CASE n.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
        n.data_criacao DESC,
        n.id DESC
      LIMIT $${valores.length}
    `,
    valores,
  );

  return rows;
};

const contarNotificacoesNaoLidas = async ({ empresaId, usuarioId }) => {
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM notificacoes
      WHERE empresa_id = $1 AND usuario_id = $2 AND lida = false
    `,
    [empresaId, usuarioId],
  );

  return rows[0]?.total || 0;
};

const marcarNotificacaoComoLida = async ({ empresaId, usuarioId, notificacaoId }) => {
  const { rows } = await pool.query(
    `
      UPDATE notificacoes
      SET lida = true
      WHERE id = $1 AND empresa_id = $2 AND usuario_id = $3
      RETURNING *
    `,
    [notificacaoId, empresaId, usuarioId],
  );

  return rows[0] || null;
};

const criarNotificacoesVendaRecente = async ({
  empresaId,
  vendaId,
  clienteNome,
  valor,
}, client = pool) => {
  const usuarios = await buscarUsuariosDaEmpresa(empresaId, client);

  return criarNotificacoesParaUsuarios({
    empresaId,
    usuarios,
    tipo: 'venda',
    titulo: 'Venda recente',
    mensagem: `Nova venda registrada para ${clienteNome} no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0))}.`,
    referenciaId: vendaId,
    referenciaTipo: 'venda',
    prioridade: 'baixa',
  }, client);
};

module.exports = {
  buscarUsuariosDaEmpresa,
  contarNotificacoesNaoLidas,
  criarNotificacao,
  criarNotificacoesParaUsuarios,
  criarNotificacoesVendaRecente,
  listarNotificacoesDoUsuario,
  marcarNotificacaoComoLida,
};
