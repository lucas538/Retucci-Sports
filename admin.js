document.addEventListener('DOMContentLoaded', () => {
    // === Sistema de Autenticação (Fácil Acesso) ===
    const adminLoginScreen = document.getElementById('admin-login-screen');
    const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    const showLogin = () => {
        adminLoginScreen.classList.remove('hidden');
        adminDashboardScreen.classList.add('hidden');
        if (loginError) loginError.textContent = '';
        if (loginForm) loginForm.reset();
    };

    const showDashboard = () => {
        adminLoginScreen.classList.add('hidden');
        adminDashboardScreen.classList.remove('hidden');
        resetProductForm();
        renderAdminProductList();
        updateMetricsDashboard();
    };

    // Verifica se já está logado na sessão atual
    const checkAuth = () => {
        const isLogged = sessionStorage.getItem('admin_logged') === 'true';
        if (isLogged) {
            showDashboard();
        } else {
            showLogin();
        }
    };

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (username === 'admin' && password === 'admin') {
                sessionStorage.setItem('admin_logged', 'true');
                showDashboard();
            } else {
                loginError.textContent = 'Usuário ou senha incorretos!';
            }
        });
    }

    // === Sistema de Banco de Dados de Produtos ===
    const seedProducts = [
        { id: '1', name: 'Camiseta Clube Azul - Modelo Principal', price: '189,90', costPrice: '80,00', qty: 10, size: 'M', status: 'Disponível', img: 'https://images.unsplash.com/photo-1583332468351-4ad90b21dfc6?w=260&h=260&fit=crop&q=80' },
        { id: '2', name: 'Camiseta Time Estrela - Modelo Away', price: '189,90', costPrice: '80,00', qty: 10, size: 'P', status: 'Disponível', img: 'https://images.unsplash.com/photo-1558914611-c9172202bb91?w=260&h=260&fit=crop&q=80' },
        { id: '3', name: 'Camiseta Dragão FC - Edição Limitada', price: '219,90', costPrice: '90,00', qty: 10, size: 'G', status: 'Disponível', img: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=260&h=260&fit=crop&q=80' },
        { id: '4', name: 'Camiseta Leão Clube - Retrô', price: '199,90', costPrice: '85,00', qty: 10, size: 'GG', status: 'Disponível', img: 'https://images.unsplash.com/photo-1628100589886-444733db9b89?w=260&h=260&fit=crop&q=80' },
        { id: '5', name: 'Camiseta Aço United - 2026', price: '179,90', costPrice: '75,00', qty: 10, size: 'PP', status: 'Disponível', img: 'https://images.unsplash.com/photo-1622359405626-d15f7f32997e?w=260&h=260&fit=crop&q=80' },
        { id: '6', name: 'Camiseta Fênix FC - Aquecimento', price: '149,90', costPrice: '60,00', qty: 10, size: 'M', status: 'Disponível', img: 'https://images.unsplash.com/photo-1596706950274-122904c6a992?w=260&h=260&fit=crop&q=80' },
        { id: '7', name: 'Camiseta Trovão City - Goleiro', price: '189,90', costPrice: '80,00', qty: 10, size: 'P', status: 'Disponível', img: 'https://images.unsplash.com/photo-1586221151604-51a8eb8d5f30?w=260&h=260&fit=crop&q=80' },
        { id: '8', name: 'Camiseta Atlético Real - Terceira', price: '199,90', costPrice: '85,00', qty: 10, size: 'G', status: 'Disponível', img: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=260&h=260&fit=crop&q=80' }
    ];

    const normalizeProducts = (items) => {
        return items.map((product, index) => ({
            ...product,
            id: product.id || `product_${index + 1}`,
            name: product.name || 'Produto sem nome',
            price: product.price || '0,00',
            costPrice: product.costPrice || '0,00',
            qty: Number.isFinite(Number(product.qty)) ? Number(product.qty) : 0,
            size: product.size || 'M',
            status: product.status || 'DisponÃ­vel',
            img: product.img || seedProducts[0].img
        }));
    };

    const loadProducts = () => {
        const stored = localStorage.getItem('rt_sports_all_products');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return normalizeProducts(parsed);
                }
            } catch (err) {
                console.warn('Falha ao ler produtos do localStorage:', err);
            }
        }
        return normalizeProducts(seedProducts);
    };

    let products = loadProducts();

    const saveProducts = () => {
        localStorage.setItem('rt_sports_all_products', JSON.stringify(products));
    };

    // === Utilitários Financeiros ===
    const parsePrice = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let clean = val.replace(/[^\d.,]/g, '');
        if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(',', '.');
        }
        return parseFloat(clean) || 0;
    };

    // === Sistema de Ledger (Histórico de Vendas) ===
    const seedSales = [
        { id: 'sale_1', productId: '1', productName: 'Camiseta Clube Azul - Modelo Principal', costPrice: 80.00, salePrice: 189.90, timestamp: Date.now() - 86400000 },
        { id: 'sale_2', productId: '3', productName: 'Camiseta Dragão FC - Edição Limitada', costPrice: 90.00, salePrice: 219.90, timestamp: Date.now() - 43200000 },
        { id: 'sale_3', productId: '5', productName: 'Camiseta Aço United - 2026', costPrice: 75.00, salePrice: 179.90, timestamp: Date.now() - 36000000 }
    ];

    let sales = JSON.parse(localStorage.getItem('rt_sports_sales')) || seedSales;

    const saveSales = () => {
        localStorage.setItem('rt_sports_sales', JSON.stringify(sales));
    };

    // === Atualização do Dashboard Financeiro ===
    const updateMetricsDashboard = () => {
        const metricRevenue = document.getElementById('metric-revenue');
        const metricCost = document.getElementById('metric-cost');
        const metricProfit = document.getElementById('metric-profit');
        const metricSalesCount = document.getElementById('metric-sales-count');

        if (!metricRevenue || !metricCost || !metricProfit || !metricSalesCount) return;

        let totalRevenue = 0;
        let totalCost = 0;

        sales.forEach(sale => {
            totalRevenue += sale.salePrice;
            totalCost += sale.costPrice;
        });

        const totalProfit = totalRevenue - totalCost;

        metricRevenue.textContent = `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        metricCost.textContent = `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        metricSalesCount.textContent = `${sales.length} un.`;

        if (totalProfit >= 0) {
            metricProfit.className = 'metric-val positive';
            metricProfit.style.color = '#aaff00';
            metricProfit.textContent = `R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            metricProfit.className = 'metric-val';
            metricProfit.style.color = '#ef5350';
            metricProfit.textContent = `R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    // === Cadastro e Edição de Produtos ===
    const addProductForm = document.getElementById('add-product-form');
    const prodNameInput = document.getElementById('prod-name');
    const prodCostInput = document.getElementById('prod-cost');
    const prodPriceInput = document.getElementById('prod-price');
    const prodSizeInput = document.getElementById('prod-size');
    const prodStatusInput = document.getElementById('prod-status');
    const customItemsList = document.getElementById('custom-items-list');
    const stockCountLabel = document.getElementById('stock-count-label');

    const btnSubmitProduct = document.getElementById('btn-submit-product');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnResetSales = document.getElementById('btn-reset-sales');

    let editingProductId = null;

    // --- Renderização dos Itens na Direita ---
    const renderAdminProductList = () => {
        if (!customItemsList) return;
        customItemsList.innerHTML = '';

        if (products.length === 0) {
            customItemsList.innerHTML = '<li style="color: #666; font-size: 0.85rem; text-align: center; padding: 2rem 0;">Nenhum produto cadastrado no estoque.</li>';
            if (stockCountLabel) stockCountLabel.textContent = '0 itens';
            return;
        }

        if (stockCountLabel) {
            const totalStock = products.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
            stockCountLabel.textContent = `${products.length} anúncios (${totalStock} un. no total)`;
        }

        products.forEach(product => {
            const li = document.createElement('li');
            li.className = 'custom-item';
            li.innerHTML = `
                <div class="admin-item-info">
                    <img src="${product.img}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid var(--cor-borda);">
                    <div style="display: flex; flex-direction: column; gap: 2px; max-width: 170px; overflow: hidden;">
                        <span style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; color: #fff;">${product.name}</span>
                        <span style="font-size: 0.75rem; color: #888;">Tamanho: ${product.size || 'M'}</span>
                        <span style="font-size: 0.75rem; color: #888;">Status: ${product.status || 'Disponível'}</span>
                    </div>
                </div>
                <div style="font-size: 0.78rem; color: #888; display: flex; gap: 8px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <label style="font-size: 0.65rem; color: #666; font-weight: 600;">CUSTO (R$)</label>
                        <input type="text" class="inline-edit-cost" data-id="${product.id}" value="${product.costPrice || '80,00'}" style="width: 65px; background: #000; border: 1px solid var(--cor-borda); border-radius: 4px; color: #aaff00; padding: 2px 4px; font-size: 0.78rem; font-weight: 700; text-align: center; transition: border-color 0.2s;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <label style="font-size: 0.65rem; color: #666; font-weight: 600;">VENDA (R$)</label>
                        <input type="text" class="inline-edit-price" data-id="${product.id}" value="${product.price}" style="width: 65px; background: #000; border: 1px solid var(--cor-borda); border-radius: 4px; color: #fff; padding: 2px 4px; font-size: 0.78rem; font-weight: 700; text-align: center; transition: border-color 0.2s;">
                    </div>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-sell" data-id="${product.id}">+1 Venda</button>
                    <button class="btn-edit" data-id="${product.id}">Editar</button>
                    <button class="btn-delete" data-id="${product.id}">Excluir</button>
                </div>
            `;
            customItemsList.appendChild(li);
        });
    };

    // --- Alterações e Cliques na lista do Admin (Edição Inline, Vender, Editar ou Excluir) ---
    if (customItemsList) {
        // Listener de Edição Direta (Inline) nos Inputs
        customItemsList.addEventListener('change', (e) => {
            const productId = e.target.getAttribute('data-id');
            if (!productId) return;

            const product = products.find(p => p.id === productId);
            if (!product) return;

            if (e.target.classList.contains('inline-edit-cost')) {
                const newCost = e.target.value.trim();
                if (newCost) {
                    product.costPrice = newCost;
                    saveProducts();
                    updateMetricsDashboard();
                    
                    // Feedback visual temporário de sucesso na borda
                    e.target.style.borderColor = '#aaff00';
                    setTimeout(() => { e.target.style.borderColor = ''; }, 800);
                }
            } else if (e.target.classList.contains('inline-edit-price')) {
                const newPrice = e.target.value.trim();
                if (newPrice) {
                    product.price = newPrice;
                    saveProducts();
                    updateMetricsDashboard();
                    
                    // Feedback visual temporário de sucesso na borda
                    e.target.style.borderColor = '#ffffff';
                    setTimeout(() => { e.target.style.borderColor = ''; }, 800);
                }
            }
        });

        customItemsList.addEventListener('click', (e) => {
            const productId = e.target.getAttribute('data-id');
            if (!productId) return;

            if (e.target.classList.contains('btn-sell')) {
                // Registrar Venda Direta
                const product = products.find(p => p.id === productId);
                if (product) {
                    if (product.qty > 0) {
                        product.qty -= 1;
                        saveProducts();

                        const sale = {
                            id: 'sale_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            productId: product.id,
                            productName: product.name,
                            costPrice: parsePrice(product.costPrice || '80,00'),
                            salePrice: parsePrice(product.price),
                            timestamp: Date.now()
                        };
                        sales.push(sale);
                        saveSales();

                        renderAdminProductList();
                        updateMetricsDashboard();
                    } else {
                        alert('Estoque esgotado! Não é possível registrar venda deste item.');
                    }
                }
            } else if (e.target.classList.contains('btn-delete')) {
                // Excluir Anúncio
                if (confirm('Tem certeza que deseja excluir este anúncio definitivamente?')) {
                    products = products.filter(p => p.id !== productId);
                    saveProducts();
                    renderAdminProductList();
                    if (editingProductId === productId) {
                        resetProductForm();
                    }
                }
            } else if (e.target.classList.contains('btn-edit')) {
                // Carregar formulário de edição
                const product = products.find(p => p.id === productId);
                if (product) {
                    editingProductId = productId;
                    prodNameInput.value = product.name;
                    prodCostInput.value = product.costPrice || '80,00';
                    prodPriceInput.value = product.price;
                    prodSizeInput.value = product.size || '';
                    loadedImageBase64 = product.img;

                    if (uploadPreview) {
                        uploadPreview.src = product.img;
                        uploadPreview.classList.remove('hidden');
                    }
                    if (uploadArea) uploadArea.classList.add('hidden');
                    if (changePhotoBadge) changePhotoBadge.classList.remove('hidden');
                    prodStatusInput.value = product.status || 'Disponível';

                    document.getElementById('form-action-title').textContent = 'Editar Camiseta';
                    btnSubmitProduct.textContent = 'Salvar Alterações';
                    btnCancelEdit.classList.remove('hidden');
                }
            }
        });
    }

    // --- Cancelar Edição ---
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', () => {
            resetProductForm();
        });
    }

    // --- Reset do Form ---
    const resetProductForm = () => {
        editingProductId = null;
        addProductForm.reset();
        prodSizeInput.value = '';
        prodStatusInput.value = '';
        loadedImageBase64 = '';
        if (uploadPreview) {
            uploadPreview.src = '';
            uploadPreview.classList.add('hidden');
        }
        if (uploadArea) uploadArea.classList.remove('hidden');
        if (changePhotoBadge) changePhotoBadge.classList.add('hidden');

        document.getElementById('form-action-title').textContent = 'Cadastrar Novo Produto';
        btnSubmitProduct.textContent = 'Adicionar Camiseta';
        btnCancelEdit.classList.add('hidden');
    };

    // --- Submit de Adicionar ou Editar ---
    if (btnResetSales) {
        btnResetSales.addEventListener('click', () => {
            if (!confirm('Deseja realmente zerar todas as vendas e limpar os valores do dashboard? O estoque atual será mantido.')) {
                return;
            }
            sales = [];
            saveSales();
            updateMetricsDashboard();
            alert('Histórico de vendas zerado. Faturamento, custo e lucro também foram reinicializados.');
        });
    }

    if (addProductForm) {
        addProductForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = prodNameInput.value.trim();
            const cost = prodCostInput.value.trim();
            const price = prodPriceInput.value.trim();
            const size = prodSizeInput.value;
            const status = prodStatusInput.value;

            if (!size) {
                alert('Por favor, selecione um tamanho antes de salvar.');
                return;
            }

            if (!status) {
                alert('Por favor, selecione o status antes de salvar.');
                return;
            }

            if (editingProductId) {
                const product = products.find(p => p.id === editingProductId);
                if (product) {
                    product.name = name;
                    product.price = price;
                    product.costPrice = cost;
                    product.size = size;
                    if (loadedImageBase64) {
                        product.img = loadedImageBase64;
                    }
                    saveProducts();
                }
            } else {
                if (!loadedImageBase64 && uploadArea) {
                    alert('Por favor, carregue uma foto do produto!');
                    return;
                }

                const newProduct = {
                    id: 'custom_' + Date.now(),
                    name: name,
                    price: price,
                    costPrice: cost,
                    qty: 10,
                    size: prodSizeInput.value,
                    status: status,
                    img: loadedImageBase64 || seedProducts[0].img
                };

                products.push(newProduct);
                saveProducts();
            }

            renderAdminProductList();
            resetProductForm();
            updateMetricsDashboard();
        });
    }

    // === Upload de Imagem e Canvas Compression ===
    const uploadArea = document.getElementById('upload-area');
    const prodFileInput = document.getElementById('prod-file');
    const uploadPreview = document.getElementById('upload-preview');
    const changePhotoBadge = document.getElementById('change-photo-badge');
    let loadedImageBase64 = '';

    if (uploadArea && prodFileInput) {
        uploadArea.addEventListener('click', () => {
            prodFileInput.click();
        });

        prodFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                compressImage(file, (base64Str) => {
                    loadedImageBase64 = base64Str;
                    uploadPreview.src = base64Str;
                    uploadPreview.classList.remove('hidden');
                    uploadArea.classList.add('hidden');
                    if (changePhotoBadge) changePhotoBadge.classList.remove('hidden');
                });
            }
        });
    }

    if (uploadPreview) {
        uploadPreview.addEventListener('click', () => {
            prodFileInput.click();
        });
    }

    if (changePhotoBadge) {
        changePhotoBadge.addEventListener('click', () => {
            prodFileInput.click();
        });
    }

    const compressImage = (file, callback) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                callback(compressedBase64);
            };
        };
    };

    // --- Executa a checagem no início ---
    checkAuth();
});
