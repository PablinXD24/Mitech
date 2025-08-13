document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const itemModal = document.getElementById('item-modal');
    const newItemBtn = document.getElementById('add-item');
    const closeModalBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-btn');
    const itemForm = document.getElementById('item-form');
    const uploadBtn = document.getElementById('upload-btn');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const itemImageInput = document.getElementById('item-image');
    const imagePreview = document.getElementById('image-preview');
    const searchInput = document.querySelector('.search-bar input');
    const searchBtn = document.querySelector('.search-bar button');
    const departmentFilter = document.getElementById('department-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const resetFiltersBtn = document.getElementById('reset-filters');
    
    // Estado da aplicação
    let items = JSON.parse(localStorage.getItem('almoxarifadoItems')) || [];
    let currentItemId = null;
    let isEditing = false;
    let currentImage = null;
    
    // Inicialização
    renderItems();
    updateStats();
    setupDragAndDrop();
    
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
    
    // Funções de Modal
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
        itemModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
        itemModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Funções de Formulário
    function resetForm() {
        itemForm.reset();
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
        } else {
            currentImage = null;
            updateImagePreview();
            removeImageBtn.disabled = true;
        }
    }
    
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const itemData = {
            id: isEditing ? currentItemId : Date.now().toString(),
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
            status: isEditing ? items.find(item => item.id === currentItemId).status : 'requested',
            createdAt: isEditing ? items.find(item => item.id === currentItemId).createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (isEditing) {
            items = items.map(item => item.id === currentItemId ? itemData : item);
        } else {
            items.push(itemData);
        }
        
        saveItems();
        renderItems();
        updateStats();
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
        if (currentImage) {
            imagePreview.innerHTML = `<img src="${currentImage}" alt="Preview">`;
        } else {
            imagePreview.innerHTML = `
                <i class="fas fa-box-open"></i>
                <span>Nenhuma imagem selecionada</span>
            `;
        }
    }
    
    // Funções de CRUD
    function saveItems() {
        localStorage.setItem('almoxarifadoItems', JSON.stringify(items));
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
            document.getElementById('requested-items').children.length;
        document.getElementById('ordered-count').textContent = 
            document.getElementById('ordered-items').children.length;
        document.getElementById('received-count').textContent = 
            document.getElementById('received-items').children.length;
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
        const draggedItem = document.querySelector(`.item-card[data-id="${itemId}"]`);
        const newStatus = this.parentElement.id.replace('-items', '');
        
        // Atualiza o status do item
        items = items.map(item => {
            if (item.id === itemId) {
                return {...item, status: newStatus};
            }
            return item;
        });
        
        saveItems();
        updateStats();
        
        // Move o card para a nova coluna
        this.appendChild(draggedItem);
        draggedItem.classList.remove('dragging');
        updateColumnCounts();
    }
    
    // Funções de Filtro
    function filterItems() {
        const searchTerm = searchInput.value.toLowerCase();
        const department = departmentFilter.value;
        const priority = priorityFilter.value;
        
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
        searchInput.value = '';
        departmentFilter.value = 'all';
        priorityFilter.value = 'all';
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
        if (e.target === itemModal || e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
});
