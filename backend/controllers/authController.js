const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const gerarToken = (usuario) => jwt.sign(
  {
    id: usuario.id,
    email: usuario.email,
    empresa_id: usuario.empresa_id,
    nivel: usuario.nivel,
  },
  process.env.JWT_SECRET,
  {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
);

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Informe email e senha para autenticação.',
    });
  }

  try {
    const query = `
      SELECT u.id, u.empresa_id, u.nome, u.email, u.senha_hash, u.nivel, e.nome AS empresa_nome
      FROM usuarios u
      INNER JOIN empresas e ON e.id = u.empresa_id
      WHERE u.email = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [email]);

    if (rows.length === 0) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(password, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    const token = gerarToken(usuario);

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso.',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        empresa_id: usuario.empresa_id,
        empresa_nome: usuario.empresa_nome,
        nivel: usuario.nivel,
      },
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const me = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.nome, u.email, u.nivel, u.empresa_id, e.nome AS empresa_nome, e.plano
      FROM usuarios u
      INNER JOIN empresas e ON e.id = u.empresa_id
      WHERE u.id = $1 AND u.empresa_id = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [req.user.id, req.user.empresa_id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário autenticado não encontrado.' });
    }

    return res.status(200).json({ sucesso: true, usuario: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  login,
  me,
};
