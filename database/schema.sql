CREATE TABLE IF NOT EXISTS empresas (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  plano VARCHAR(50) NOT NULL,
  data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT empresas_plano_check CHECK (plano IN ('basico', 'profissional', 'enterprise'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nivel VARCHAR(20) NOT NULL,
  CONSTRAINT fk_usuarios_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT usuarios_nivel_check CHECK (nivel IN ('admin', 'vendedor')),
  CONSTRAINT usuarios_email_unico_por_empresa UNIQUE (empresa_id, email),
  CONSTRAINT usuarios_id_empresa_unique UNIQUE (id, empresa_id)
);

CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(150),
  cidade VARCHAR(100),
  endereco VARCHAR(255),
  endereco_fiscal VARCHAR(255),
  cpf VARCHAR(14),
  cnpj VARCHAR(18),
  tipo VARCHAR(20) NOT NULL DEFAULT 'residencial',
  origem_lead VARCHAR(100),
  status_pipeline VARCHAR(30) NOT NULL DEFAULT 'lead',
  observacoes TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clientes_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT clientes_tipo_check CHECK (tipo IN ('residencial', 'comercial')),
  CONSTRAINT clientes_status_pipeline_check CHECK (status_pipeline IN ('lead', 'contato', 'visita', 'orcamento', 'negociacao', 'venda')),
  CONSTRAINT clientes_id_empresa_unique UNIQUE (id, empresa_id)
);

CREATE TABLE IF NOT EXISTS visitas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  data_visita DATE NOT NULL,
  tipo_visita VARCHAR(30) NOT NULL,
  imagem_desenho_url TEXT NOT NULL,
  imagem_local_url TEXT,
  observacoes TEXT,
  resultado VARCHAR(30) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_visitas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_visitas_cliente_empresa
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES clientes (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT visitas_tipo_check CHECK (tipo_visita IN ('orcamento', 'manutencao', 'pos_venda')),
  CONSTRAINT visitas_resultado_check CHECK (resultado IN ('orcamento', 'venda', 'sem_interesse', 'retorno'))
);


CREATE TABLE IF NOT EXISTS orcamentos (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  visita_id BIGINT,
  descricao TEXT NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_validade DATE NOT NULL,
  CONSTRAINT fk_orcamentos_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orcamentos_cliente_empresa
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES clientes (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orcamentos_visita_empresa
    FOREIGN KEY (visita_id, empresa_id)
    REFERENCES visitas (id, empresa_id)
    ON DELETE SET NULL,
  CONSTRAINT orcamentos_status_check CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  CONSTRAINT orcamentos_valor_positivo CHECK (valor >= 0)
);


CREATE TABLE IF NOT EXISTS follow_ups (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  referencia_id BIGINT NOT NULL,
  data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_proxima_acao TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  mensagem TEXT NOT NULL,
  responsavel_id BIGINT NOT NULL,
  concluido_em TIMESTAMP,
  CONSTRAINT fk_followups_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_followups_cliente_empresa
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES clientes (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_followups_responsavel_empresa
    FOREIGN KEY (responsavel_id, empresa_id)
    REFERENCES usuarios (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT followups_tipo_check CHECK (tipo IN ('orcamento', 'visita', 'venda')),
  CONSTRAINT followups_status_check CHECK (status IN ('pendente', 'concluido', 'cancelado'))
);

CREATE TABLE IF NOT EXISTS vendas (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  orcamento_id BIGINT,
  valor NUMERIC(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL,
  forma_pagamento VARCHAR(50) NOT NULL,
  data_venda DATE NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendas_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vendas_cliente_empresa
    FOREIGN KEY (cliente_id, empresa_id)
    REFERENCES clientes (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_vendas_orcamento_empresa
    FOREIGN KEY (orcamento_id, empresa_id)
    REFERENCES orcamentos (id, empresa_id)
    ON DELETE SET NULL,
  CONSTRAINT vendas_status_check CHECK (status IN ('em_andamento', 'fechado')),
  CONSTRAINT vendas_valor_positivo CHECK (valor >= 0)
);


CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  titulo VARCHAR(160) NOT NULL,
  mensagem TEXT NOT NULL,
  referencia_id BIGINT,
  referencia_tipo VARCHAR(20) NOT NULL DEFAULT 'sistema',
  lida BOOLEAN NOT NULL DEFAULT false,
  prioridade VARCHAR(10) NOT NULL DEFAULT 'media',
  data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificacoes_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_notificacoes_usuario_empresa
    FOREIGN KEY (usuario_id, empresa_id)
    REFERENCES usuarios (id, empresa_id)
    ON DELETE CASCADE,
  CONSTRAINT notificacoes_tipo_check CHECK (tipo IN ('followup', 'visita', 'venda', 'sistema')),
  CONSTRAINT notificacoes_referencia_tipo_check CHECK (referencia_tipo IN ('cliente', 'visita', 'orcamento', 'venda', 'followup', 'sistema')),
  CONSTRAINT notificacoes_prioridade_check CHECK (prioridade IN ('baixa', 'media', 'alta'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_nome ON clientes (empresa_id, nome);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_status_criado_em ON clientes (empresa_id, status_pipeline, criado_em);
CREATE INDEX IF NOT EXISTS idx_visitas_empresa_data_tipo ON visitas (empresa_id, data_visita, tipo_visita);
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa_status ON orcamentos (empresa_id, status, data_criacao);
CREATE INDEX IF NOT EXISTS idx_followups_empresa_responsavel_status ON follow_ups (empresa_id, responsavel_id, status, data_proxima_acao);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_id_data ON vendas (empresa_id, data_venda);
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa_usuario_lida ON notificacoes (empresa_id, usuario_id, lida, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa_tipo_referencia ON notificacoes (empresa_id, tipo, referencia_tipo, referencia_id);
