// Configuração do Firebase (substitua com suas credenciais)
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Estado da aplicação
let currentUser = null;
let items = [];
let currentItemId = null;
let isEditing = false;
let currentImage = null;

document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Verifica se o usuário já está logado
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
        const email = document.getElementById('login-email').value + '@miratech.com'; // Adiciona domínio padrão
        const password = document.getElementById('login-password').value;
        
        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                alert('Erro no login: ' + error.message);
            });
    });

    // Evento de logout
    logoutBtn.addEventListener('click', function() {
        auth.signOut();
    });

    // Cria usuário padrão (executar apenas uma vez)
    createDefaultUser();
});

function setupApplication() {
    // Elementos do DOM da aplicação principal
    const newItemBtn = document.getElementById('add-item');
    const closeModalBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-btn');
    const itemForm = document.getElementById('item-form');
    const uploadBtn = document.getElementById('upload-btn');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const itemImageInput = document.getElementById('item-image');
    const searchInput = document.querySelector('.search-bar input');
    const searchBtn = document.querySelector('.search-bar button');
    const departmentFilter = document.getElementById('department-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const resetFiltersBtn = document.getElementById('reset-filters');
    
    // Event Listeners
    newItemBtn.addEventListener('click', openNewItemModal);
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
    resetFiltersBtn.addEventListener('click', resetFilters);

    // Configura drag and drop
    setupDragAndDrop();
}

// Funções de Autenticação
function createDefaultUser() {
    const email = 'Miratech@miratech.com';
    const password = 'Almo25';
    
    auth.createUserWithEmailAndPassword(email, password)
        .catch((error) => {
            if (error.code !== 'auth/email-already-in-use') {
                console.error('Erro ao criar usuário padrão:', error);
            }
        });
}

// Funções de CRUD
function loadItems() {
    db.collection('items')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            renderItems();
            updateStats();
        }, error => {
            console.error('Erro ao carregar itens:', error);
        });
}

function saveItem(itemData) {
    itemData.userId = currentUser.uid;
    itemData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
    if (isEditing) {
        db.collection('items').doc(itemData.id).update(itemData)
            .catch(error => {
                console.error('Erro ao atualizar item:', error);
                alert('Erro ao salvar item');
            });
    } else {
        itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('items').add(itemData)
            .catch(error => {
                console.error('Erro ao adicionar item:', error);
                alert('Erro ao salvar item');
            });
    }
}

function deleteItem(itemId) {
    db.collection('items').doc(itemId).delete()
        .catch(error => {
            console.error('Erro ao deletar item:', error);
            alert('Erro ao deletar item');
        });
}

// Funções de Interface
function openNewItemModal() {
    isEditing = false;
    currentItemId = null;
    currentImage = null;
    resetForm();
    document.getElementById('modal-title').textContent = 'Novo Item';
    openModal();
}

function openEditItemModal(item) {
    isEditing = true;
    currentItemId = item.id;
    currentImage = item.image || null;
    populateForm(item);
    document.getElementById('modal-title').textContent = 'Editar Item';
    openModal();
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
    currentImage = null;
    updateImagePreview();
    removeImageBtn.disabled = true;
}

function populateForm(item) {
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-code').value = item.code || '';
    document.getElementById('item-category').value = item.category || '';
    document.getElementById('item-department').value = item.department;
    document.getElementById('item-quantity').value = item.quantity;
    document.getElementById('item-unit').value = item.unit;
    document.getElementById('item-priority').value = item.priority;
    document.getElementById('item-request-date').value = item.requestDate;
    document.getElementById('item-due-date').value = item.dueDate || '';
    document.getElementById('item-payment').value = item.payment;
    document.getElementById('item-supplier').value = item.supplier || '';
    document.getElementById('item-notes').value = item.notes || '';
    
    if (item.image) {
        currentImage = item.image;
        updateImagePreview();
        removeImageBtn.disabled = false;
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const itemData = {
        id: isEditing ? currentItemId : undefined,
        name: document.getElementById('item-name').value,
        code: document.getElementById('item-code').value,
        category: document.getElementById('item-category').value,
        department: document.getElementById('item-department').value,
        quantity: parseInt(document.getElementById('item-quantity').value),
        unit: document.getElementById('item-unit').value,
        priority: document.getElementById('item-priority').value,
        requestDate: document.getElementById('item-request-date').value,
        dueDate: document.getElementById('item-due-date').value || null,
        payment: document.getElementById('item-payment').value,
        supplier: document.getElementById('item-supplier').value || null,
        notes: document.getElementById('item-notes').value || null,
        image: currentImage,
        status: isEditing ? items.find(item => item.id === currentItemId).status : 'requested'
    };
    
    saveItem(itemData);
    closeModal();
}

// Funções de Imagem
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        currentImage = event.target.result;
        updateImagePreview();
        removeImageBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    currentImage = null;
    itemImageInput.value = '';
    updateImagePreview();
    removeImageBtn.disabled = true;
}

function updateImagePreview() {
    const imagePreview = document.getElementById('image-preview');
    if (currentImage) {
        imagePreview.innerHTML = `<img src="${currentImage}" alt="Preview">`;
    } else {
        imagePreview.innerHTML = `
            <i class="fas fa-box-open"></i>
            <span>Nenhuma imagem selecionada</span>
        `;
    }
}

// Funções de Renderização
function renderItems() {
    clearColumns();
    
    items.forEach(item => {
        const card = createItemCard(item);
        document.getElementById(`${item.status}-items`).appendChild(card);
    });
    
    updateColumnCounts();
}

function clearColumns() {
    document.getElementById('requested-items').innerHTML = '';
    document.getElementById('ordered-items').innerHTML = '';
    document.getElementById('received-items').innerHTML = '';
}

function createItemCard(item) {
    const card = document.createElement('div');
    card.className = `item-card priority-${item.priority}`;
    card.dataset.id = item.id;
    card.draggable = true;
    
    const priorityText = {
        'high': 'Alta',
        'medium': 'Média',
        'low': 'Baixa'
    }[item.priority];
    
    const paymentText = {
        'cash': 'À vista',
        'installment': 'Parcelado',
        'consigned': 'Consignado'
    }[item.payment] || item.payment;
    
    card.innerHTML = `
        <div class="item-header">
            <h3 class="item-title">${item.name}</h3>
            <span class="item-priority priority-${item.priority}">${priorityText}</span>
        </div>
        
        <div class="item-image">
            ${item.image ? 
                `<img src="${item.image}" alt="${item.name}">` : 
                `<i class="fas fa-box-open"></i>`
            }
        </div>
        
        <div class="item-details">
            <div class="item-detail-row">
                <span class="item-detail-label">Quantidade:</span>
                <span>${item.quantity} ${item.unit}</span>
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
        
        <div class="item-department">${item.department}</div>
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

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const itemId = e.dataTransfer.getData('text/plain');
    const newStatus = this.parentElement.id.replace('-items', '');
    
    // Atualiza o status no Firestore
    db.collection('items').doc(itemId).update({
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
        console.error('Erro ao atualizar status:', error);
    });
}

// Funções de Filtro
function filterItems() {
    const searchTerm = document.querySelector('.search-bar input').value.toLowerCase();
    const department = document.getElementById('department-filter').value;
    const priority = document.getElementById('priority-filter').value;
    
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                             (item.code && item.code.toLowerCase().includes(searchTerm));
        const matchesDepartment = department === 'all' || item.department === department;
        const matchesPriority = priority === 'all' || item.priority === priority;
        
        return matchesSearch && matchesDepartment && matchesPriority;
    });
    
    clearColumns();
    
    filteredItems.forEach(item => {
        const card = createItemCard(item);
        document.getElementById(`${item.status}-items`).appendChild(card);
    });
    
    updateColumnCounts();
}

function resetFilters() {
    document.querySelector('.search-bar input').value = '';
    document.getElementById('department-filter').value = 'all';
    document.getElementById('priority-filter').value = 'all';
    filterItems();
}

// Funções Auxiliares
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Fecha modal ao clicar fora
window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('item-modal') || e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});
