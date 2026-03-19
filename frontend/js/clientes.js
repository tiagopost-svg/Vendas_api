const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const token = localStorage.getItem('crm_token');

const empresaBadge = document.getElementById('empresaBadge');
const clienteForm = document.getElementById('clienteForm');
const clienteIdInput = document.getElementById('clienteId');
const nomeInput = document.getElementById('nome');
const telefoneInput = document.getElementById('telefone');
const emailInput = document.getElementById('email');
const cidadeInput = document.getElementById('cidade');
const enderecoInput = document.getElementById('endereco');
const enderecoFiscalInput = document.getElementById('endereco_fiscal');
const cpfInput = document.getElementById('cpf');
const cnpjInput = document.getElementById('cnpj');
const tipoInput = document.getElementById('tipo');
const origemLeadInput = document.getElementById('origem_lead');
const statusPipelineInput = document.getElementById('status_pipeline');
const observacoesInput = document.getElementById('observacoes');
const buscaInput = document.getElementById('busca');
const filtroStatusInput = document.getElementById('filtroStatus');
const ordenacaoInput = document.getElementById('ordenacao');
const clientesTabelaBody = document.getElementById('clientesTabelaBody');
const clientesMensagem = document.getElementById('clientesMensagem');
const cancelarEdicaoButton = document.getElementById('cancelarEdicao');
const recarregarClientesButton = document.getElementById('recarregarClientes');
const paginaAnteriorButton = document.getElementById('paginaAnterior');
const proximaPaginaButton = document.getElementById('proximaPagina');
const paginacaoInfo = document.getElementById('paginacaoInfo');

let paginaAtual = 1;
let totalPaginas = 1;
const limitePagina = 10;

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  clientesMensagem.className = `alert alert-${tipo} mt-3`;
  clientesMensagem.textContent = mensagem;
  clientesMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  clientesMensagem.classList.add('d-none');
  clientesMensagem.textContent = '';
};

const resetarFormulario = () => {
  clienteForm.reset();
  clienteIdInput.value = '';
  tipoInput.value = 'residencial';
  statusPipelineInput.value = 'lead';
  cancelarEdicaoButton.classList.add('d-none');
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

const preencherFormulario = (cliente) => {
  clienteIdInput.value = cliente.id;
  nomeInput.value = cliente.nome;
  telefoneInput.value = cliente.telefone || '';
  emailInput.value = cliente.email || '';
  cidadeInput.value = cliente.cidade || '';
  enderecoInput.value = cliente.endereco || '';
  enderecoFiscalInput.value = cliente.endereco_fiscal || '';
  cpfInput.value = cliente.cpf || '';
  cnpjInput.value = cliente.cnpj || '';
  tipoInput.value = cliente.tipo;
  origemLeadInput.value = cliente.origem_lead || '';
  statusPipelineInput.value = cliente.status_pipeline;
  observacoesInput.value = cliente.observacoes || '';
  cancelarEdicaoButton.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderizarClientes = (clientes) => {
  if (!clientes.length) {
    clientesTabelaBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">Nenhum cliente encontrado.</td>
      </tr>
    `;
    return;
  }

  clientesTabelaBody.innerHTML = clientes
    .map(
      (cliente) => `
        <tr>
          <td>${cliente.id}</td>
          <td>
            <div class="fw-semibold">${cliente.nome}</div>
            <div class="text-muted small">${cliente.tipo}</div>
          </td>
          <td>
            <div>${cliente.telefone || '-'}</div>
            <div class="text-muted small">${cliente.email || '-'}</div>
          </td>
          <td><span class="badge text-bg-primary">${cliente.status_pipeline}</span></td>
          <td>${cliente.origem_lead || '-'}</td>
          <td>${cliente.cidade || '-'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary me-2" data-action="detalhe" data-id="${cliente.id}">Timeline</button>
            <button class="btn btn-sm btn-outline-primary me-2" data-action="editar" data-id="${cliente.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger" data-action="excluir" data-id="${cliente.id}">Excluir</button>
          </td>
        </tr>
      `,
    )
    .join('');
};

const atualizarPaginacao = (paginacao) => {
  paginaAtual = paginacao.page;
  totalPaginas = paginacao.total_paginas;
  paginacaoInfo.textContent = `Página ${paginacao.page} de ${paginacao.total_paginas} • ${paginacao.total} cliente(s)`;
  paginaAnteriorButton.disabled = paginaAtual <= 1;
  proximaPaginaButton.disabled = paginaAtual >= totalPaginas;
};

const carregarPerfil = async () => {
  const data = await request('/auth/me', { method: 'GET' });
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const construirQueryString = () => {
  const params = new URLSearchParams({
    page: String(paginaAtual),
    limit: String(limitePagina),
    order: ordenacaoInput.value,
  });

  if (buscaInput.value.trim()) {
    params.set('busca', buscaInput.value.trim());
  }

  if (filtroStatusInput.value) {
    params.set('status', filtroStatusInput.value);
  }

  return params.toString();
};

const carregarClientes = async () => {
  try {
    const data = await request(`/clientes?${construirQueryString()}`, { method: 'GET' });
    renderizarClientes(data.dados);
    atualizarPaginacao(data.paginacao);
  } catch (error) {
    renderizarClientes([]);
    exibirMensagem(error.message, 'danger');
  }
};

clienteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagem();

  const payload = {
    nome: nomeInput.value,
    telefone: telefoneInput.value,
    email: emailInput.value,
    cidade: cidadeInput.value,
    endereco: enderecoInput.value,
    endereco_fiscal: enderecoFiscalInput.value,
    cpf: cpfInput.value,
    cnpj: cnpjInput.value,
    tipo: tipoInput.value,
    origem_lead: origemLeadInput.value,
    status_pipeline: statusPipelineInput.value,
    observacoes: observacoesInput.value,
  };

  try {
    const clienteId = clienteIdInput.value;
    const endpoint = clienteId ? `/clientes/${clienteId}` : '/clientes';
    const method = clienteId ? 'PUT' : 'POST';

    await request(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    exibirMensagem(clienteId ? 'Cliente atualizado com sucesso.' : 'Cliente criado com sucesso.', 'success');
    resetarFormulario();
    paginaAtual = 1;
    await carregarClientes();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

cancelarEdicaoButton.addEventListener('click', () => {
  resetarFormulario();
  limparMensagem();
});

recarregarClientesButton.addEventListener('click', async () => {
  paginaAtual = 1;
  await carregarClientes();
});

buscaInput.addEventListener('input', async () => {
  paginaAtual = 1;
  await carregarClientes();
});

filtroStatusInput.addEventListener('change', async () => {
  paginaAtual = 1;
  await carregarClientes();
});

ordenacaoInput.addEventListener('change', async () => {
  paginaAtual = 1;
  await carregarClientes();
});

paginaAnteriorButton.addEventListener('click', async () => {
  if (paginaAtual > 1) {
    paginaAtual -= 1;
    await carregarClientes();
  }
});

proximaPaginaButton.addEventListener('click', async () => {
  if (paginaAtual < totalPaginas) {
    paginaAtual += 1;
    await carregarClientes();
  }
});

clientesTabelaBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  try {
    if (action === 'detalhe') {
      window.location.href = `cliente_detalhe.html?id=${id}`;
      return;
    }

    if (action === 'editar') {
      const data = await request(`/clientes/${id}`, { method: 'GET' });
      preencherFormulario(data.dados);
      return;
    }

    if (action === 'excluir') {
      const confirmar = window.confirm('Deseja realmente excluir este cliente?');

      if (!confirmar) {
        return;
      }

      await request(`/clientes/${id}`, { method: 'DELETE' });
      exibirMensagem('Cliente excluído com sucesso.', 'success');
      await carregarClientes();
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
    resetarFormulario();
    await carregarClientes();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
