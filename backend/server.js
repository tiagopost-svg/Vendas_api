const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const pool = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const visitasRoutes = require('./routes/visitasRoutes');
const vendasRoutes = require('./routes/vendasRoutes');
const orcamentosRoutes = require('./routes/orcamentosRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const followupsRoutes = require('./routes/followupsRoutes');
const notificacoesRoutes = require('./routes/notificacoesRoutes');
const { iniciarAutomacaoFollowups } = require('./services/followupAutomationService');
const { iniciarAutomacaoNotificacoes } = require('./services/notificacaoAutomationService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const frontendPath = path.resolve(__dirname, '../frontend');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (_, res) => {
  try {
    await pool.query('SELECT NOW()');
    return res.status(200).json({ sucesso: true, mensagem: 'API online e PostgreSQL acessível.' });
  } catch (error) {
    return res.status(500).json({
      sucesso: false,
      mensagem: 'API online, mas houve falha na conexão com PostgreSQL.',
      detalhe: error.message,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/visitas', visitasRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/orcamentos', orcamentosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/notificacoes', notificacoesRoutes);

app.use(express.static(frontendPath));

iniciarAutomacaoFollowups();
iniciarAutomacaoNotificacoes();

app.listen(PORT, HOST, () => {
  console.log(`Servidor CRM SaaS rodando em ${HOST}:${PORT}`);
});
