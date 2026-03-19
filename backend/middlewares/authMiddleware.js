const jwt = require('jsonwebtoken');

const protegerRotas = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ sucesso: false, mensagem: 'Token não informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      empresa_id: payload.empresa_id,
      nivel: payload.nivel,
    };
    return next();
  } catch (error) {
    return res.status(401).json({ sucesso: false, mensagem: 'Token inválido ou expirado.' });
  }
};

module.exports = {
  protegerRotas,
};
