const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
});

pool.on('connect', () => {
  console.log('PostgreSQL conectado com sucesso.');
});

pool.on('error', (error) => {
  console.error('Erro inesperado no PostgreSQL:', error.message);
});

module.exports = pool;
