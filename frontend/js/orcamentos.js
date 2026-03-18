const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('crm_token');
let orcamentosCache = [];
let visitasCache = [];
const orcamentoEmDestaqueId = new URLSearchParams(window.location.search).get('orcamento_id');

const empresaBadge = document.getElementById('empresaBadge');
const orcamentoForm = document.getElementById('orcamentoForm');
const orcamentoIdInput = document.getElementById('orcamentoId');
const visitaIdInput = document.getElementById('visita_id');
const clienteIdInput = document.getElementById('cliente_id');
const descricaoInput = document.getElementById('descricao');
const valorInput = document.getElementById('valor');
const statusInput = document.getElementById('status');
const dataValidadeInput = document.getElementById('data_validade');
const filtroStatusInput = document.getElementById('filtroStatus');
const orcamentosLista = document.getElementById('orcamentosLista');
const orcamentosMensagem = document.getElementById('orcamentosMensagem');
const cancelarEdicaoButton = document.getElementById('cancelarEdicao');
const recarregarOrcamentosButton = document.getElementById('recarregarOrcamentos');

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  orcamentosMensagem.className = `alert alert-${tipo} mt-3`;
  orcamentosMensagem.textContent = mensagem;
  orcamentosMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  orcamentosMensagem.classList.add('d-none');
  orcamentosMensagem.textContent = '';
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    redirecionarParaLogin();
    throw new Error('Sessão expirada.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensagem || 'Falha na requisição.');
  }

  return data;
};

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

const resetarFormulario = () => {
  orcamentoForm.reset();
  orcamentoIdInput.value = '';
  cancelarEdicaoButton.classList.add('d-none');
};

const carregarPerfil = async () => {
  const data = await request('/auth/me');
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarClientes = async () => {
  const data = await request('/clientes?page=1&limit=100&order=asc');
  clienteIdInput.innerHTML = '<option value="">Selecione um cliente</option>';
  data.dados.forEach((cliente) => {
    clienteIdInput.insertAdjacentHTML('beforeend', `<option value="${cliente.id}">${cliente.nome} #${cliente.id}</option>`);
  });
};

const carregarVisitas = async () => {
  const data = await request('/visitas');
  visitasCache = data.dados;
  visitaIdInput.innerHTML = '<option value="">Sem vínculo</option>';
  data.dados.forEach((visita) => {
    visitaIdInput.insertAdjacentHTML('beforeend', `<option value="${visita.id}">${visita.cliente_nome} • ${visita.data_visita}</option>`);
  });
};

const carregarOrcamentos = async () => {
  try {
    const status = filtroStatusInput.value;
    const endpoint = status ? `/orcamentos?status=${encodeURIComponent(status)}` : '/orcamentos';
    const data = await request(endpoint);
    orcamentosCache = data.dados;
    renderizarOrcamentos(data.dados);
    destacarOrcamentoDaUrl();
  } catch (error) {
    renderizarOrcamentos([]);
    exibirMensagem(error.message, 'danger');
  }
};

const preencherFormulario = (orcamento) => {
  orcamentoIdInput.value = orcamento.id;
  visitaIdInput.value = orcamento.visita_id || '';
  clienteIdInput.value = orcamento.cliente_id;
  descricaoInput.value = orcamento.descricao;
  valorInput.value = orcamento.valor;
  statusInput.value = orcamento.status;
  dataValidadeInput.value = orcamento.data_validade;
  cancelarEdicaoButton.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const destacarOrcamentoDaUrl = () => {
  if (!orcamentoEmDestaqueId) return;

  const card = document.getElementById(`orcamento-card-${orcamentoEmDestaqueId}`);
  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const renderizarOrcamentos = (orcamentos) => {
  if (!orcamentos.length) {
    orcamentosLista.innerHTML = '<div class="col-12 text-center text-muted py-4">Nenhum orçamento encontrado.</div>';
    return;
  }

  orcamentosLista.innerHTML = orcamentos
    .map((orcamento) => `
      <div class="col-12">
        <div class="card border-0 bg-light-subtle shadow-sm ${String(orcamento.id) === String(orcamentoEmDestaqueId) ? 'orcamento-highlight' : ''}" id="orcamento-card-${orcamento.id}">
          <div class="card-body d-flex flex-column flex-md-row justify-content-between gap-3">
            <div>
              <div class="fw-semibold">${orcamento.cliente_nome}</div>
              <div class="small text-muted">Criação: ${orcamento.data_criacao} • Validade: ${orcamento.data_validade}</div>
              <div class="small">${orcamento.descricao}</div>
              <div class="small">Status: <strong>${orcamento.status}</strong></div>
              <div class="small">Valor: <strong>${formatarMoeda(orcamento.valor)}</strong></div>
            </div>
            <div class="d-grid gap-2 d-md-flex flex-wrap">
              <button class="btn btn-outline-primary" data-action="editar" data-id="${orcamento.id}">Editar</button>
              <button class="btn btn-success" data-action="converter" data-id="${orcamento.id}">Converter em venda</button>
              <button class="btn btn-outline-danger" data-action="excluir" data-id="${orcamento.id}">Excluir</button>
            </div>
          </div>
        </div>
      </div>
    `)
    .join('');
};

visitaIdInput.addEventListener('change', () => {
  const visitaSelecionada = visitasCache.find((visita) => String(visita.id) === String(visitaIdInput.value));
  if (visitaSelecionada) {
    clienteIdInput.value = visitaSelecionada.cliente_id;
  }
});

orcamentoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagem();

  const payload = {
    cliente_id: clienteIdInput.value ? Number(clienteIdInput.value) : null,
    visita_id: visitaIdInput.value ? Number(visitaIdInput.value) : null,
    descricao: descricaoInput.value,
    valor: Number(valorInput.value),
    status: statusInput.value,
    data_validade: dataValidadeInput.value,
  };

  try {
    const orcamentoId = orcamentoIdInput.value;
    const endpoint = orcamentoId ? `/orcamentos/${orcamentoId}` : '/orcamentos';
    const method = orcamentoId ? 'PUT' : 'POST';
    await request(endpoint, { method, body: JSON.stringify(payload) });
    exibirMensagem(orcamentoId ? 'Orçamento atualizado com sucesso.' : 'Orçamento criado com sucesso.', 'success');
    resetarFormulario();
    await carregarOrcamentos();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

cancelarEdicaoButton.addEventListener('click', () => {
  resetarFormulario();
  limparMensagem();
});

recarregarOrcamentosButton.addEventListener('click', carregarOrcamentos);
filtroStatusInput.addEventListener('change', carregarOrcamentos);

orcamentosLista.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  try {
    if (action === 'editar') {
      const data = await request(`/orcamentos/${id}`);
      preencherFormulario(data.dados);
      return;
    }

    if (action === 'converter') {
      const formaPagamento = window.prompt('Informe a forma de pagamento para converter em venda:', 'PIX');
      if (!formaPagamento) return;
      const dataVenda = new Date().toISOString().slice(0, 10);
      await request(`/orcamentos/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ forma_pagamento: formaPagamento, data_venda: dataVenda }),
      });
      exibirMensagem('Orçamento convertido em venda com sucesso.', 'success');
      await carregarOrcamentos();
      return;
    }

    if (action === 'excluir') {
      const confirmar = window.confirm('Deseja realmente excluir este orçamento?');
      if (!confirmar) return;
      await request(`/orcamentos/${id}`, { method: 'DELETE' });
      exibirMensagem('Orçamento excluído com sucesso.', 'success');
      await carregarOrcamentos();
    }
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

const iniciarTela = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await Promise.all([carregarClientes(), carregarVisitas(), carregarOrcamentos()]);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
