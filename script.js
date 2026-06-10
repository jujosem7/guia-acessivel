// ==================== CONFIGURAÇÃO DO SUPABASE ====================
// ⚠️ IMPORTANTE: Substitua pelos seus dados do Supabase (pegue no passo a passo)
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';

// Inicializa o cliente do Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== VARIÁVEIS GLOBAIS ====================
let usuarioLogado = null;
let imagemSelecionadaBase64 = null;
let editandoId = null;

const dicasDoDia = [
    "Fale diretamente com a pessoa, não apenas com o acompanhante.",
    "Prefira 'pessoa com deficiência' em vez de 'excepcional' ou 'especial'.",
    "Nunca toque na cadeira de rodas, bengala ou cão-guia sem permissão.",
    "Use frases curtas e claras na comunicação. Dê tempo para a pessoa responder.",
    "Pergunte 'Como posso ajudar?' em vez de presumir necessidades."
];

// ==================== VERIFICAÇÃO DE AUTENTICAÇÃO ====================
async function verificarSessao() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        usuarioLogado = session.user;
        
        // Verificar se é master (meta_data role = 'master')
        const isMaster = session.user.user_metadata?.role === 'master';
        
        if (window.location.pathname.includes('dashboard-master.html')) {
            if (!isMaster) {
                alert('Acesso negado. Você não é administrador.');
                window.location.href = 'index.html';
            }
        } else {
            if (isMaster && !window.location.pathname.includes('dashboard-master.html')) {
                // Master logado fora do dashboard, redireciona
                window.location.href = 'dashboard-master.html';
            } else {
                carregarHome();
            }
        }
    } else {
        if (!window.location.pathname.includes('index.html') && !window.location.pathname.includes('cadastro.html')) {
            window.location.href = 'index.html';
        }
    }
}

function verificarAcesso() {
    if (usuarioLogado) {
        if (usuarioLogado.user_metadata?.role === 'master') {
            window.location.href = 'dashboard-master.html';
        } else {
            showScreen('home');
        }
    } else {
        showScreen('login');
    }
}

// ==================== LOGIN E CADASTRO ====================
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (error) {
        alert('Erro no login: ' + error.message);
        return;
    }

    usuarioLogado = data.user;
    const isMaster = data.user.user_metadata?.role === 'master';
    
    if (isMaster) {
        window.location.href = 'dashboard-master.html';
    } else {
        window.location.href = 'index.html';
    }
}

async function handleCadastro(event) {
    event.preventDefault();
    const nome = document.getElementById('cadNome').value;
    const email = document.getElementById('cadEmail').value;
    const senha = document.getElementById('cadSenha').value;

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: senha,
        options: {
            data: {
                nome: nome,
                role: 'user' // Todos os cadastros comuns são 'user'
            }
        }
    });

    if (error) {
        alert('Erro no cadastro: ' + error.message);
        return;
    }

    alert('✅ Cadastro realizado com sucesso! Verifique seu e-mail para confirmar (se necessário) ou faça login.');
    window.location.href = 'index.html';
}

async function logout() {
    await supabase.auth.signOut();
    usuarioLogado = null;
    window.location.href = 'index.html';
}

// ==================== FUNÇÕES DA HOME ====================
async function carregarHome() {
    if (!usuarioLogado && !window.location.pathname.includes('cadastro.html')) {
        showScreen('login');
        return;
    }

    // Buscar termos do Supabase
    const { data: termos, error } = await supabase
        .from('termos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar termos:', error);
        return;
    }

    // Destaques (3 primeiros)
    const destaquesHTML = (termos || []).slice(0, 3).map(termo => `
        <div onclick="verDetalhe('${termo.id}')" class="bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition">
            <h3 class="text-sm font-bold text-indigo-600">${escapeHtml(termo.termo)}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 mt-1">${escapeHtml(termo.significado.substring(0, 80))}</p>
        </div>
    `).join('');
    
    const container = document.getElementById('destaquesContainer');
    if (container) container.innerHTML = destaquesHTML || '<p class="text-slate-400">Nenhum termo cadastrado</p>';

    // Dica do dia
    const dicaAleatoria = dicasDoDia[Math.floor(Math.random() * dicasDoDia.length)];
    const dicaEl = document.getElementById('dicaTexto');
    if (dicaEl) dicaEl.innerHTML = dicaAleatoria;

    // Sugestões (categorias únicas)
    const categorias = [...new Set((termos || []).map(t => t.categoria).filter(c => c))];
    const sugestoesHTML = categorias.map(cat => 
        `<button onclick="buscarPorCategoria('${cat}')" class="px-2 py-1 bg-slate-100 rounded-full text-xs hover:bg-indigo-100 transition">${escapeHtml(cat)}</button>`
    ).join('');
    
    const sugestoesEl = document.getElementById('sugestoesContainer');
    if (sugestoesEl) sugestoesEl.innerHTML = sugestoesHTML;
}

async function searchTerm() {
    if (!usuarioLogado) {
        alert('🔒 Faça login para pesquisar os termos!');
        showScreen('login');
        return;
    }
    
    const busca = document.getElementById('searchInputHome').value.toLowerCase();
    
    const { data: termos, error } = await supabase
        .from('termos')
        .select('*')
        .ilike('termo', `%${busca}%`);
    
    if (error) {
        alert('Erro na busca');
        return;
    }
    
    if (termos && termos.length > 0) {
        verDetalhe(termos[0].id);
    } else {
        alert('Termo não encontrado. Tente outro termo.');
    }
}

async function buscarPorCategoria(categoria) {
    if (!usuarioLogado) {
        showScreen('login');
        return;
    }
    
    const { data: termos } = await supabase
        .from('termos')
        .select('*')
        .eq('categoria', categoria);
    
    if (termos && termos.length > 0) {
        verDetalhe(termos[0].id);
    }
}

async function verDetalhe(id) {
    if (!usuarioLogado) {
        showScreen('login');
        return;
    }
    
    const { data: termo, error } = await supabase
        .from('termos')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error || !termo) return;
    
    const detalhesHTML = `
        <div class="grid md:grid-cols-2">
            <div class="bg-slate-100 p-4 flex items-center justify-center min-h-[200px]">
                ${termo.imagem_url ? 
                    `<img src="${termo.imagem_url}" class="max-h-40 rounded shadow object-contain">` : 
                    `<div class="text-center text-slate-400 text-sm">
                        <svg class="w-12 h-12 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        📷 Sem imagem
                    </div>`
                }
            </div>
            <div class="p-4 space-y-3">
                <span class="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">${escapeHtml(termo.categoria || 'Termo')}</span>
                <h1 class="text-xl font-bold text-slate-900">${escapeHtml(termo.termo)}</h1>
                <p class="text-sm text-slate-600"><strong>📖 Significado:</strong> ${escapeHtml(termo.significado)}</p>
                <div class="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <strong class="text-amber-800 text-xs">✨ Dica de aplicação:</strong>
                    <p class="text-sm text-amber-900 mt-1">${escapeHtml(termo.dica_aplicacao)}</p>
                </div>
                <div class="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <strong class="text-indigo-800 text-xs">🧠 Como a pessoa assimila:</strong>
                    <p class="text-sm text-indigo-900 mt-1">${escapeHtml(termo.dica_assimilacao)}</p>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('detalhesContainer');
    if (container) container.innerHTML = detalhesHTML;
    showScreen('detail');
}

// ==================== FUNÇÕES MASTER (DASHBOARD) ====================
async function carregarTermosMaster() {
    const { data: termos, error } = await supabase
        .from('termos')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erro:', error);
        return;
    }
    
    const listaHTML = (termos || []).map(termo => `
        <tr class="border-b border-slate-100">
            <td class="p-4 font-medium text-sm">${escapeHtml(termo.termo)}</td>
            <td class="p-4 text-xs text-slate-500">${escapeHtml(termo.categoria || '-')}</td>
            <td class="p-4 text-xs text-slate-500 truncate max-w-xs">${escapeHtml(termo.significado.substring(0, 80))}...</td>
            <td class="p-4 text-right">
                <button onclick="editarTermo('${termo.id}')" class="text-indigo-600 text-xs mr-3 hover:text-indigo-800">✏️ Editar</button>
                <button onclick="excluirTermo('${termo.id}')" class="text-red-500 text-xs hover:text-red-700">🗑️ Excluir</button>
            </td>
        </tr>
    `).join('');
    
    const listaEl = document.getElementById('listaTermos');
    if (listaEl) listaEl.innerHTML = listaHTML || '<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhum termo cadastrado</td></tr>';
}

function showForm() {
    document.getElementById('formTermo').classList.remove('hidden');
    document.getElementById('formTermo').scrollIntoView({ behavior: 'smooth' });
}

function hideForm() {
    document.getElementById('formTermo').classList.add('hidden');
    document.getElementById('termoNome').value = '';
    document.getElementById('termoCategoria').value = '';
    document.getElementById('termoSignificado').value = '';
    document.getElementById('termoDicaAplicacao').value = '';
    document.getElementById('termoDicaAssimilacao').value = '';
    removerImagem();
    editandoId = null;
}

function previewImagem(event) {
    const file = event.target.files[0];
    if (file && file.type.match('image.*')) {
        if (file.size > 5 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 5MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            imagemSelecionadaBase64 = e.target.result;
            document.getElementById('imgPreview').src = imagemSelecionadaBase64;
            document.getElementById('previewContainer').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removerImagem() {
    imagemSelecionadaBase64 = null;
    document.getElementById('previewContainer').classList.add('hidden');
    document.getElementById('imagemUpload').value = '';
}

async function salvarTermo(event) {
    event.preventDefault();
    
    let imagemUrl = null;
    
    // Upload da imagem para o Supabase Storage
    if (imagemSelecionadaBase64) {
        // Converter Base64 para Blob
        const blob = await fetch(imagemSelecionadaBase64).then(r => r.blob());
        const fileName = `${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
            .from('imagens-termos')
            .upload(fileName, blob);
        
        if (!error) {
            const { data: { publicUrl } } = supabase.storage
                .from('imagens-termos')
                .getPublicUrl(fileName);
            imagemUrl = publicUrl;
        }
    }
    
    const termoData = {
        termo: document.getElementById('termoNome').value,
        categoria: document.getElementById('termoCategoria').value || 'Geral',
        significado: document.getElementById('termoSignificado').value,
        imagem_url: imagemUrl,
        dica_aplicacao: document.getElementById('termoDicaAplicacao').value,
        dica_assimilacao: document.getElementById('termoDicaAssimilacao').value
    };
    
    let result;
    if (editandoId) {
        result = await supabase
            .from('termos')
            .update(termoData)
            .eq('id', editandoId);
    } else {
        result = await supabase
            .from('termos')
            .insert([termoData]);
    }
    
    if (result.error) {
        alert('Erro ao salvar: ' + result.error.message);
        return;
    }
    
    alert(editandoId ? 'Termo atualizado!' : 'Termo adicionado!');
    hideForm();
    carregarTermosMaster();
}

async function editarTermo(id) {
    const { data: termo, error } = await supabase
        .from('termos')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error || !termo) return;
    
    editandoId = id;
    document.getElementById('termoNome').value = termo.termo;
    document.getElementById('termoCategoria').value = termo.categoria;
    document.getElementById('termoSignificado').value = termo.significado;
    document.getElementById('termoDicaAplicacao').value = termo.dica_aplicacao;
    document.getElementById('termoDicaAssimilacao').value = termo.dica_assimilacao;
    
    showForm();
}

async function excluirTermo(id) {
    if (!confirm('⚠️ Tem certeza? Esta ação não pode ser desfeita.')) return;
    
    const { error } = await supabase
        .from('termos')
        .delete()
        .eq('id', id);
    
    if (error) {
        alert('Erro ao excluir: ' + error.message);
        return;
    }
    
    alert('Termo excluído!');
    carregarTermosMaster();
}

// ==================== FUNÇÕES DE TELA ====================
function showScreen(screenId) {
    const screens = ['home', 'login', 'detail'];
    screens.forEach(id => {
        const el = document.getElementById(`screen-${id}`);
        if (el) el.classList.add('hidden');
    });
    
    const targetEl = document.getElementById(`screen-${screenId}`);
    if (targetEl) targetEl.classList.remove('hidden');
    
    // Atualizar botões
    const btnHome = document.getElementById('btn-home');
    const btnLogin = document.getElementById('btn-login');
    
    if (btnHome) {
        btnHome.className = screenId === 'home' ? 
            "px-3 py-1.5 rounded-md bg-white text-indigo-600 shadow-sm transition" : 
            "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition";
    }
    
    if (btnLogin) {
        if (usuarioLogado) {
            btnLogin.innerHTML = 'Sair';
            btnLogin.onclick = logout;
            btnLogin.className = "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition";
        } else {
            btnLogin.innerHTML = 'Entrar';
            btnLogin.onclick = () => showScreen('login');
            btnLogin.className = screenId === 'login' ? 
                "px-3 py-1.5 rounded-md bg-white text-indigo-600 shadow-sm transition" : 
                "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition";
        }
    }
    
    window.scrollTo({ top: 0 });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    verificarSessao();
    
    // Drag and drop para upload
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('border-indigo-500', 'bg-indigo-50');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
            const file = e.dataTransfer.files[0];
            if (file && file.type.match('image.*')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imagemSelecionadaBase64 = ev.target.result;
                    document.getElementById('imgPreview').src = imagemSelecionadaBase64;
                    document.getElementById('previewContainer').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Carregar termos no dashboard se estiver nessa página
    if (window.location.pathname.includes('dashboard-master.html')) {
        carregarTermosMaster();
    }
});