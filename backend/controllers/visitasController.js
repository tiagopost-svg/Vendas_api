const pool = require('../config/db');
const { uploadFileToDrive } = require('../services/googleDriveService');
const { criarFollowupAutomaticoVisitaSemOrcamento } = require('../services/followupService');

const TIPOS_VALIDOS = ['orcamento', 'manutencao', 'pos_venda'];
const RESULTADOS_VALIDOS = ['orcamento', 'venda', 'sem_interesse', 'retorno'];

const buscarClienteDaEmpresa = async (clienteId, empresaId) => {
  const query = 'SELECT id, nome FROM clientes WHERE id = $1 AND empresa_id = $2 LIMIT 1';
  const { rows } = await pool.query(query, [clienteId, empresaId]);
  return rows[0] || null;
};

const queryBaseVisitas = `
  SELECT
    v.*, 
    c.nome AS cliente_nome,
    c.telefone AS cliente_telefone,
    c.endereco AS cliente_endereco,
    c.cidade AS cliente_cidade,
    TRIM(CONCAT_WS(', ', c.endereco, c.cidade)) AS cliente_endereco_completo
  FROM visitas v
  INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
`;

const listarVisitas = async (req, res) => {
  try {
    const query = `
      ${queryBaseVisitas}
      WHERE v.empresa_id = $1
      ORDER BY v.data_visita DESC, v.criado_em DESC
    `;
    const { rows } = await pool.query(query, [req.user.empresa_id]);
    return res.status(200).json({ sucesso: true, dados: rows });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const buscarVisitaPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      ${queryBaseVisitas}
      WHERE v.id = $1 AND v.empresa_id = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Visita não encontrada para esta empresa.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const criarVisita = async (req, res) => {
  const { cliente_id, data_visita, tipo_visita, observacoes, resultado } = req.body;
  const imagemDesenho = req.files?.imagem_desenho?.[0];
  const imagemLocal = req.files?.imagem_local?.[0] || null;

  if (!cliente_id || !data_visita || !tipo_visita || !resultado || !imagemDesenho) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'cliente_id, data_visita, tipo_visita, resultado e imagem_desenho são obrigatórios.',
    });
  }

  if (!TIPOS_VALIDOS.includes(tipo_visita)) {
    return res.status(400).json({ sucesso: false, mensagem: 'tipo_visita inválido.' });
  }

  if (!RESULTADOS_VALIDOS.includes(resultado)) {
    return res.status(400).json({ sucesso: false, mensagem: 'resultado inválido.' });
  }

  try {
    const cliente = await buscarClienteDaEmpresa(cliente_id, req.user.empresa_id);

    if (!cliente) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O cliente informado não pertence à empresa do usuário logado.',
      });
    }

    const desenhoUpload = await uploadFileToDrive(
      imagemDesenho,
      process.env.GOOGLE_DRIVE_DESENHOS_FOLDER_ID,
      req.user.empresa_id,
    );
    const localUpload = imagemLocal
      ? await uploadFileToDrive(
          imagemLocal,
          process.env.GOOGLE_DRIVE_IMAGENS_FOLDER_ID,
          req.user.empresa_id,
        )
      : null;

    const query = `
      INSERT INTO visitas (
        empresa_id,
        cliente_id,
        data_visita,
        tipo_visita,
        imagem_desenho_url,
        imagem_local_url,
        observacoes,
        resultado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      req.user.empresa_id,
      cliente_id,
      data_visita,
      tipo_visita,
      desenhoUpload.publicUrl,
      localUpload?.publicUrl || null,
      observacoes || null,
      resultado,
    ];
    const { rows } = await pool.query(query, values);

    if (resultado !== 'orcamento') {
      await criarFollowupAutomaticoVisitaSemOrcamento({
        empresaId: req.user.empresa_id,
        clienteId: cliente_id,
        visitaId: rows[0].id,
        responsavelId: req.user.id,
      });
    }

    return res.status(201).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const excluirVisita = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM visitas
      WHERE id = $1 AND empresa_id = $2
      RETURNING id, cliente_id, imagem_desenho_url, imagem_local_url
    `;
    const { rows } = await pool.query(query, [id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Visita não encontrada para esta empresa.' });
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Visita excluída com sucesso.',
      dados: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  criarVisita,
  listarVisitas,
  buscarVisitaPorId,
  excluirVisita,
};
