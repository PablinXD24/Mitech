// Configuração do Firebase com suas credenciais
const firebaseConfig = {
  apiKey: "AIzaSyC5eNMJx-yz3YBLdV-vp0eAK_vXDAOZuOQ",
  authDomain: "miratech-48f84.firebaseapp.com",
  projectId: "miratech-48f84",
  storageBucket: "miratech-48f84.firebasestorage.app",
  messagingSenderId: "510124501557",
  appId: "1:510124501557:web:1e19e6cdb3cba69b0a5f7c",
  measurementId: "G-G4LBTK9MTV"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Estado da aplicação
let currentUser = null;
let items = [];
let currentItemId = null;
let isEditing = false;
let currentImageFile = null;

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Verifica estado de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loginContainer.style.display = 'none';
            appContainer.style.display = 'block';
            loadItems();
            setupApplication();
        } else {
            currentUser = null;
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    // Evento de login
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // Verifica se o email já contém o domínio
        const finalEmail = email.includes('@') ? email : email + '@miratech.com';
        
        auth.signInWithEmailAndPassword(finalEmail, password)
            .catch((error) => {
                alert('Erro no login: ' + error.message);
            });
    });

    // Evento de logout
    logoutBtn.addEventListener('click', function() {
        auth.signOut();
    });

    // Cria usuário padrão se não existir
    createDefaultUser();
});

function setupApplication() {
    // Configura todos os event listeners da aplicação principal
    const newItemBtn = document.getElementById('add-item');
    const menuBtn = document.getElementById('menu-btn');
    const closeMenuBtn = document.getElementById('close-menu');
    const closeModalBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-btn');
    const itemForm = document.getElementById('item-form');
    const uploadBtn = document.getElementById('upload-btn');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const itemImageInput = document.getElementById('item-image');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const departmentFilter = document.getElementById('department-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const statusFilter = document.getElementById('status-filter');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const exportBtn = document.getElementById('export-btn');

    // Event Listeners
    newItemBtn.addEventListener('click', openNewItemModal);
    menuBtn.addEventListener('click', toggleItemsMenu);
    closeMenuBtn.addEventListener('click', toggleItemsMenu);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    itemForm.addEventListener('submit', handleFormSubmit);
    uploadBtn.addEventListener('click', () => itemImageInput.click());
    removeImageBtn.addEventListener('click', removeImage);
    itemImageInput.addEventListener('change', handleImageUpload);
    searchBtn.addEventListener('click', filterItems);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') filterItems();
    });
    departmentFilter.addEventListener('change', filterItems);
    priorityFilter.addEventListener('change', filterItems);
    statusFilter.addEventListener('change', filterItems);
    resetFiltersBtn.addEventListener('click', resetFilters);
    exportBtn.addEventListener('click', exportToExcel);

    // Configura drag and drop
    setupDragAndDrop();
    
    // Define a data atual como padrão para o campo de data de solicitação
    document.getElementById('item-request-date').valueAsDate = new Date();
}

// Funções de Autenticação
function createDefaultUser() {
    const email = 'Miratech@miratech.com';
    const password = 'Almo25';

    auth.createUserWithEmailAndPassword(email, password)
        .catch((error) => {
            if (error.code !== 'auth/email-already-in-use') {
                console.log('Usuário padrão já existe ou outro erro:', error.message);
            }
        });
}

// Funções de CRUD
function loadItems() {
    console.log("Carregando itens para o usuário:", currentUser.uid);
    
    // Consulta simplificada sem ordenação complexa para evitar necessidade de índice
    db.collection('items')
        .where('userId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            items = [];
            snapshot.forEach(doc => {
                const item = doc.data();
                item.id = doc.id;
                items.push(item);
                console.log("Item carregado:", item.name, "Status:", item.status);
            });
            
            // Ordena localmente por data de criação (mais recente primeiro)
            items.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
                }
                return 0;
            });
            
            renderItems();
            updateStats();
            updateItemsTable();
        }, error => {
            console.error('Erro ao carregar itens:', error);
            // Tenta carregar sem o filtro se houver erro de permissão
            if (error.code === 'permission-denied') {
                loadAllItems();
            }
        });
}

// Fallback se o usuário não tiver permissão para consultar com filtro
function loadAllItems() {
    db.collection('items')
        .get()
        .then(snapshot => {
            items = [];
            snapshot.forEach(doc => {
                const item = doc.data();
                item.id = doc.id;
                // Filtra localmente por usuário
                if (item.userId === currentUser.uid) {
                    items.push(item);
                    console.log("Item carregado (fallback):", item.name, "Status:", item.status);
                }
            });
            
            // Ordena localmente por data de criação
            items.sort((a, b) => {
                if (a.createdAt && b.createdAt) {
                    return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
                }
                return 0;
            });
            
            renderItems();
            updateStats();
            updateItemsTable();
        })
        .catch(error => {
            console.error('Erro ao carregar todos os itens:', error);
        });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validação dos campos obrigatórios
    const itemName = document.getElementById('item-name').value;
    const itemQuantity = document.getElementById('item-quantity').value;
    const itemDepartment = document.getElementById('item-department').value;
    
    if (!itemName || !itemQuantity || !itemDepartment) {
        alert("Preencha todos os campos obrigatórios (*)");
        return;
    }

    try {
        let imageUrl = null;
        
        // Upload da imagem se existir
        if (currentImageFile) {
            const storageRef = storage.ref(`items/${currentUser.uid}/${Date.now()}_${currentImageFile.name}`);
            const snapshot = await storageRef.put(currentImageFile);
            imageUrl = await snapshot.ref.getDownloadURL();
        }

        // Objeto com os dados do item
        const itemData = {
            name: itemName,
            code: document.getElementById('item-code').value || '',
            category: document.getElementById('item-category').value || '',
            department: itemDepartment,
            quantity: parseInt(itemQuantity),
            unit: document.getElementById('item-unit').value,
            priority: document.getElementById('item-priority').value,
            requestDate: document.getElementById('item-request-date').value,
            dueDate: document.getElementById('item-due-date').value || '',
            payment: document.getElementById('item-payment').value,
            supplier: document.getElementById('item-supplier').value || '',
            notes: document.getElementById('item-notes').value || '',
            image: imageUrl || '',
            status: isEditing ? items.find(item => item.id === currentItemId)?.status || 'requested' : 'requested',
            userId: currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Adiciona createdAt apenas para novos itens
        if (!isEditing) {
            itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        // Salva no Firestore
        if (isEditing) {
            await db.collection('items').doc(currentItemId).update(itemData);
            console.log("Item atualizado:", itemData.name);
        } else {
            const docRef = await db.collection('items').add(itemData);
            console.log("Novo item criado com ID:", docRef.id, "Nome:", itemData.name);
        }

        closeModal();
        resetForm();
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        alert('Erro ao salvar item. Verifique o console.');
    }
}

function deleteItem(itemId, event) {
    if (event) event.stopPropagation();
    
    if (confirm('Tem certeza que deseja excluir este item?')) {
        db.collection('items').doc(itemId).delete()
            .then(() => {
                console.log("Item excluído:", itemId);
            })
            .catch(error => {
                console.error('Erro ao deletar item:', error);
                alert('Erro ao deletar item');
            });
    }
}

// Funções de Interface
function openNewItemModal() {
    isEditing = false;
    currentItemId = null;
    currentImageFile = null;
    resetForm();
    document.getElementById('modal-title').textContent = 'Novo Item';
    openModal();
}

function openEditItemModal(item) {
    isEditing = true;
    currentItemId = item.id;
    currentImageFile = null;
    populateForm(item);
    document.getElementById('modal-title').textContent = 'Editar Item';
    openModal();
}

function toggleItemsMenu() {
    const itemsMenu = document.getElementById('items-menu');
    const kanbanContainer = document.querySelector('.kanban-container');
    const statsContainer = document.querySelector('.stats-container');
    
    if (itemsMenu.style.display === 'none') {
        itemsMenu.style.display = 'block';
        kanbanContainer.style.display = 'none';
        statsContainer.style.display = 'none';
        updateItemsTable();
    } else {
        itemsMenu.style.display = 'none';
        kanbanContainer.style.display = 'flex';
        statsContainer.style.display = 'flex';
    }
}

function openModal() {
    document.getElementById('item-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('item-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function resetForm() {
    document.getElementById('item-form').reset();
    currentImageFile = null;
    updateImagePreview();
    document.getElementById('remove-image-btn').disabled = true;
    document.getElementById('item-request-date').valueAsDate = new Date();
}

function populateForm(item) {
    document.getElementById('item-name').value = item.name || '';
    document.getElementById('item-code').value = item.code || '';
    document.getElementById('item-category').value = item.category || '';
    document.getElementById('item-department').value = item.department || '';
    document.getElementById('item-quantity').value = item.quantity || '';
    document.getElementById('item-unit').value = item.unit || 'un';
    document.getElementById('item-priority').value = item.priority || 'medium';
    document.getElementById('item-request-date').value = item.requestDate || '';
    document.getElementById('item-due-date').value = item.dueDate || '';
    document.getElementById('item-payment').value = item.payment || 'cash';
    document.getElementById('item-supplier').value = item.supplier || '';
    document.getElementById('item-notes').value = item.notes || '';
    
    if (item.image) {
        document.getElementById('image-preview').innerHTML = `<img src="${item.image}" alt="Preview">`;
        document.getElementById('remove-image-btn').disabled = false;
    } else {
        updateImagePreview();
    }
}

// Funções de Imagem
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Verifica se o arquivo é uma imagem
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
    }
    
    currentImageFile = file;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        document.getElementById('image-preview').innerHTML = `<img src="${event.target.result}" alt="Preview">`;
        document.getElementById('remove-image-btn').disabled = false;
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    currentImageFile = null;
    document.getElementById('item-image').value = '';
    updateImagePreview();
    document.getElementById('remove-image-btn').disabled = true;
}

function updateImagePreview() {
    document.getElementById('image-preview').innerHTML = `
        <i class="fas fa-box-open"></i>
        <span>Nenhuma imagem selecionada</span>
    `;
}

// Funções de Renderização
function renderItems() {
    console.log("Renderizando", items.length, "itens");
    clearColumns();
    
    if (items.length === 0) {
        showEmptyState();
        return;
    }
    
    items.forEach(item => {
        const card = createItemCard(item);
        const columnElement = document.getElementById(`${item.status}-items`);
        if (columnElement) {
            columnElement.appendChild(card);
            console.log("Item adicionado à coluna:", item.status, "-", item.name);
        } else {
            console.error("Coluna não encontrada:", `${item.status}-items`);
            // Fallback: adiciona à coluna requested se a coluna não for encontrada
            document.getElementById('requested-items').appendChild(card);
        }
    });
    
    updateColumnCounts();
}

function updateItemsTable() {
    const tableBody = document.getElementById('items-table-body');
    tableBody.innerHTML = '';
    
    if (items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.5; margin-bottom: 1rem;"></i>
                    <p>Nenhum item cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    items.forEach(item => {
        const row = document.createElement('tr');
        
        const statusText = {
            'requested': 'Requerido',
            'ordered': 'Pedido',
            'received': 'Recebido'
        }[item.status] || item.status;
        
        row.innerHTML = `
            <td>${item.name || 'Sem nome'}</td>
            <td>${item.code || 'N/A'}</td>
            <td>${item.department || 'Não especificado'}</td>
            <td>${item.quantity || 0} ${item.unit || 'un'}</td>
            <td><span class="status-badge status-${item.status}">${statusText}</span></td>
            <td>${getPriorityText(item.priority)}</td>
            <td>${formatDate(item.requestDate)}</td>
            <td class="table-actions">
                <button class="btn-secondary" onclick="openEditItemModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger" onclick="deleteItem('${item.id}', event)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function getPriorityText(priority) {
    const priorityMap = {
        'high': 'Alta',
        'medium': 'Média',
        'low': 'Baixa'
    };
    return priorityMap[priority] || priority || 'Média';
}

function clearColumns() {
    const columns = ['requested', 'ordered', 'received'];
    columns.forEach(status => {
        const column = document.getElementById(`${status}-items`);
        if (column) {
            column.innerHTML = '';
        }
    });
}

function showEmptyState() {
    const columns = ['requested', 'ordered', 'received'];
    columns.forEach(status => {
        const column = document.getElementById(`${status}-items`);
        if (column) {
            column.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum item ${getStatusText(status)}</p>
                </div>
            `;
        }
    });
}

function getStatusText(status) {
    const statusMap = {
        'requested': 'requerido',
        'ordered': 'pedido', 
        'received': 'recebido'
    };
    return statusMap[status] || status;
}

function createItemCard(item) {
    const card = document.createElement('div');
    card.className = `item-card priority-${item.priority || 'medium'}`;
    card.dataset.id = item.id;
    card.draggable = true;
    
    const priorityText = {
        'high': 'Alta',
        'medium': 'Média',
        'low': 'Baixa'
    }[item.priority] || 'Média';
    
    const paymentText = {
        'cash': 'À vista',
        'installment': 'Parcelado',
        'consigned': 'Consignado'
    }[item.payment] || item.payment || 'À vista';
    
    card.innerHTML = `
        <div class="item-header">
            <h3 class="item-title">${item.name || 'Sem nome'}</h3>
            <span class="item-priority priority-${item.priority || 'medium'}">${priorityText}</span>
        </div>
        
        <div class="item-image">
            ${item.image ? 
                `<img src="${item.image}" alt="${item.name || 'Item'}">` : 
                `<i class="fas fa-box-open"></i>`
            }
        </div>
        
        <div class="item-details">
            <div class="item-detail-row">
                <span class="item-detail-label">Quantidade:</span>
                <span>${item.quantity || 0} ${item.unit || 'un'}</span>
            </div>
            <div class="item-detail-row">
                <span class="item-detail-label">Solicitado em:</span>
                <span>${formatDate(item.requestDate)}</span>
            </div>
            ${item.dueDate ? `
            <div class="item-detail-row">
                <span class="item-detail-label">Previsão:</span>
                <span>${formatDate(item.dueDate)}</span>
            </div>
            ` : ''}
            <div class="item-detail-row">
                <span class="item-detail-label">Pagamento:</span>
                <span>${paymentText}</span>
            </div>
        </div>
        
        <div class="item-department">${item.department || 'Não especificado'}</div>
        
        <div class="item-actions">
            <button class="btn-danger delete-btn" onclick="deleteItem('${item.id}', event)">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    card.addEventListener('click', () => openEditItemModal(item));
    card.addEventListener('dragstart', handleDragStart);
    
    return card;
}

function updateColumnCounts() {
    document.getElementById('requested-count').textContent = 
        items.filter(item => item.status === 'requested').length;
    document.getElementById('ordered-count').textContent = 
        items.filter(item => item.status === 'ordered').length;
    document.getElementById('received-count').textContent = 
        items.filter(item => item.status === 'received').length;
}

function updateStats() {
    document.getElementById('total-items').textContent = items.length;
    document.getElementById('pending-items').textContent = 
        items.filter(item => item.status !== 'received').length;
    document.getElementById('high-priority-items').textContent = 
        items.filter(item => item.priority === 'high').length;
    
    // Itens atrasados (com dueDate no passado e status não 'received')
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('overdue-items').textContent = 
        items.filter(item => item.dueDate && item.dueDate < today && item.status !== 'received').length;
}

// Funções de Drag and Drop
function setupDragAndDrop() {
    const columns = document.querySelectorAll('.column-body');
    
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    setTimeout(() => {
        e.target.classList.add('dragging');
    }, 0);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const itemId = e.dataTransfer.getData('text/plain');
    const newStatus = this.id.replace('-items', '');
    
    try {
        await db.collection('items').doc(itemId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Item movido para:", newStatus);
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao mover item. Verifique o console.');
    }
}

// Funções de Filtro
function filterItems() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const department = document.getElementById('department-filter').value;
    const priority = document.getElementById('priority-filter').value;
    const status = document.getElementById('status-filter').value;
    
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                             (item.code && item.code.toLowerCase().includes(searchTerm)) ||
                             (item.supplier && item.supplier.toLowerCase().includes(searchTerm));
        const matchesDepartment = department === 'all' || item.department === department;
        const matchesPriority = priority === 'all' || item.priority === priority;
        const matchesStatus = status === 'all' || item.status === status;
        
        return matchesSearch && matchesDepartment && matchesPriority && matchesStatus;
    });
    
    clearColumns();
    
    filteredItems.forEach(item => {
        const card = createItemCard(item);
        const columnElement = document.getElementById(`${item.status}-items`);
        if (columnElement) {
            columnElement.appendChild(card);
        }
    });
    
    updateColumnCounts();
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('department-filter').value = 'all';
    document.getElementById('priority-filter').value = 'all';
    document.getElementById('status-filter').value = 'all';
    renderItems();
}

// Função de exportação para Excel
function exportToExcel() {
    // Preparar dados para exportação
    const dataForExport = items.map(item => ({
        'Nome': item.name || '',
        'Código': item.code || '',
        'Categoria': item.category || '',
        'Departamento': item.department || '',
        'Quantidade': item.quantity || 0,
        'Unidade': item.unit || '',
        'Prioridade': getPriorityText(item.priority),
        'Status': getStatusText(item.status).toUpperCase(),
        'Data Solicitação': formatDate(item.requestDate),
        'Data Prevista': formatDate(item.dueDate),
        'Pagamento': {
            'cash': 'À vista',
            'installment': 'Parcelado',
            'consigned': 'Consignado'
        }[item.payment] || item.payment || '',
        'Fornecedor': item.supplier || '',
        'Observações': item.notes || ''
    }));
    
    // Criar planilha
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens Almoxarifado');
    
    // Gerar arquivo e fazer download
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `almoxarifado_miratech_${today}.xlsx`);
}

// Funções Auxiliares
function formatDate(dateString) {
    if (!dateString) return 'Não informada';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

// Fecha modal ao clicar fora
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('item-modal')) {
        closeModal();
    }
});
