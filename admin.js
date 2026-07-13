document.addEventListener('DOMContentLoaded', () => {
    // === Sistema de Autenticação (Fácil Acesso) ===
    const adminLoginScreen = document.getElementById('admin-login-screen');
    const adminDashboardScreen = document.getElementById('admin-dashboard-screen');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const btnLogout = document.getElementById('btn-logout');

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

    // Login real via Firebase Authentication (e-mail/senha)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = usernameInput.value.trim();
            const password = passwordInput.value;

            loginError.textContent = '';
            auth.signInWithEmailAndPassword(email, password).catch(() => {
                loginError.textContent = 'E-mail ou senha incorretos!';
            });
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            auth.signOut();
        });
    }

    // Reage a login/logout automaticamente (inclusive em outras abas).
    // A leitura da coleção "sales" exige estar autenticado (regras do Firestore),
    // então só assina/desassina esse listener conforme o estado de login.
    let unsubscribeSales = null;
    auth.onAuthStateChanged((user) => {
        if (user) {
            showDashboard();
            if (!unsubscribeSales) {
                unsubscribeSales = salesRef.onSnapshot((snapshot) => {
                    sales = snapshot.docs.map((doc) => doc.data());
                    updateMetricsDashboard();
                    renderPerformanceChart();
                });
            }
        } else {
            showLogin();
            if (unsubscribeSales) {
                unsubscribeSales();
                unsubscribeSales = null;
            }
            sales = [];
        }
    });

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

    // Produtos ficam salvos no Firestore (coleção "products") e sincronizados
    // em tempo real entre todos os dispositivos/abas — ver firebase-config.js
    const productsRef = db.collection('products');
    let products = normalizeProducts(seedProducts);

    const seedProductsIfEmpty = async () => {
        const snapshot = await productsRef.limit(1).get();
        if (snapshot.empty) {
            const batch = db.batch();
            normalizeProducts(seedProducts).forEach((product) => batch.set(productsRef.doc(product.id), product));
            await batch.commit();
        }
    };
    seedProductsIfEmpty();

    productsRef.onSnapshot((snapshot) => {
        if (!snapshot.empty) {
            products = normalizeProducts(snapshot.docs.map((doc) => doc.data()));
        }
        renderAdminProductList();
        updateMetricsDashboard();
    });

    const saveProduct = (product) => {
        productsRef.doc(product.id).set(product).catch((err) => console.error('Erro ao salvar produto:', err));
    };

    const deleteProductRemote = (id) => {
        productsRef.doc(id).delete().catch((err) => console.error('Erro ao excluir produto:', err));
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

    // === Sistema de Ledger (Histórico de Vendas) — também no Firestore ===
    // A assinatura em tempo real desta coleção é aberta/fechada em auth.onAuthStateChanged,
    // pois a leitura de vendas exige estar autenticado como admin (ver regras do Firestore).
    const salesRef = db.collection('sales');
    let sales = [];

    const registerSale = (product) => {
        salesRef.add({
            productId: product.id,
            productName: product.name,
            costPrice: parsePrice(product.costPrice || '80,00'),
            salePrice: parsePrice(product.price),
            timestamp: Date.now()
        }).catch((err) => console.error('Erro ao registrar venda:', err));
    };

    const clearAllSales = async () => {
        const snapshot = await salesRef.get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
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

    // === Gráfico de Desempenho (Lucro Líquido / Vendas) — últimos 14 dias ===
    const CHART_DAYS = 14;
    const CHART_COLORS = { profitPos: '#aaff00', profitNeg: '#ef5350', sales: '#4dd0e1' };
    let currentChartMetric = 'profit';

    const chartMetricToggle = document.getElementById('chart-metric-toggle');
    const performanceChartEl = document.getElementById('performance-chart');
    const chartTooltip = document.getElementById('chart-tooltip');
    const chartTooltipDate = document.getElementById('chart-tooltip-date');
    const chartTooltipValue = document.getElementById('chart-tooltip-value');
    const btnToggleTable = document.getElementById('btn-toggle-table');
    const performanceTableWrapper = document.getElementById('performance-table-wrapper');
    const performanceTableBody = document.getElementById('performance-table-body');
    const performanceTableMetricLabel = document.getElementById('performance-table-metric-label');

    const formatBRL = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Monta os últimos CHART_DAYS dias (incluindo hoje) e soma lucro/qtd de vendas de cada um
    const buildDailySeries = () => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = CHART_DAYS - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            days.push({ date, profit: 0, count: 0 });
        }

        sales.forEach((sale) => {
            const saleDate = new Date(sale.timestamp);
            saleDate.setHours(0, 0, 0, 0);
            const day = days.find((d) => d.date.getTime() === saleDate.getTime());
            if (day) {
                day.profit += (sale.salePrice - sale.costPrice);
                day.count += 1;
            }
        });

        return days;
    };

    // Gera o "d" de um <path> com cantos arredondados só na ponta oposta à linha de base
    const roundedBarPath = (x, y, w, h, r, roundTop) => {
        const radius = Math.max(0, Math.min(r, w / 2, h));
        if (roundTop) {
            return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
        }
        return `M${x},${y} L${x},${y + h - radius} Q${x},${y + h} ${x + radius},${y + h} L${x + w - radius},${y + h} Q${x + w},${y + h} ${x + w},${y + h - radius} L${x + w},${y} Z`;
    };

    const renderPerformanceChart = () => {
        if (!performanceChartEl) return;

        const days = buildDailySeries();
        const isProfit = currentChartMetric === 'profit';
        const values = days.map((d) => (isProfit ? d.profit : d.count));

        const width = 720;
        const height = 220;
        const paddingLeft = 34;
        const paddingRight = 6;
        const paddingTop = 16;
        const paddingBottom = 24;
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        const baselineY = paddingTop + chartHeight;

        const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
        const hasNegative = isProfit && values.some((v) => v < 0);
        const zeroY = hasNegative ? paddingTop + chartHeight / 2 : baselineY;
        const usableHeight = hasNegative ? chartHeight / 2 : chartHeight;

        const slotWidth = chartWidth / days.length;
        const barWidth = Math.min(24, slotWidth * 0.6);

        let svg = '';

        const gridYs = hasNegative
            ? [paddingTop, zeroY, baselineY]
            : [paddingTop, paddingTop + chartHeight / 2, baselineY];
        gridYs.forEach((y) => {
            svg += `<line class="chart-gridline" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" />`;
        });

        days.forEach((day, i) => {
            const value = values[i];
            const rawHeight = Math.abs(value) * (usableHeight / maxAbs);
            const barHeight = value !== 0 ? Math.max(rawHeight, 3) : 0;
            const slotX = paddingLeft + slotWidth * i;
            const barX = slotX + (slotWidth - barWidth) / 2;

            let color = CHART_COLORS.sales;
            if (isProfit) {
                color = value >= 0 ? CHART_COLORS.profitPos : CHART_COLORS.profitNeg;
            }

            const dayLabel = String(day.date.getDate()).padStart(2, '0');
            const fullLabel = day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const valueLabel = isProfit ? formatBRL(value) : `${value} venda${value === 1 ? '' : 's'}`;

            let barMarkup = '';
            if (barHeight > 0) {
                const roundTop = value >= 0;
                const barY = value >= 0 ? zeroY - barHeight : zeroY;
                const d = roundedBarPath(barX, barY, barWidth, barHeight, 4, roundTop);
                barMarkup = `<path class="chart-bar-fill" d="${d}" fill="${color}"></path>`;
            }

            svg += `
                <g>
                    ${barMarkup}
                    <rect class="chart-bar-hit" data-date="${fullLabel}" data-value="${valueLabel}"
                        x="${slotX}" y="${paddingTop}" width="${slotWidth}" height="${chartHeight}"
                        tabindex="0" role="img" aria-label="${fullLabel}: ${valueLabel}"></rect>
                    <text class="chart-axis-label" x="${slotX + slotWidth / 2}" y="${height - 8}" text-anchor="middle">${dayLabel}</text>
                </g>
            `;
        });

        performanceChartEl.innerHTML = svg;

        performanceChartEl.querySelectorAll('.chart-bar-hit').forEach((hitArea) => {
            const showTooltip = () => {
                const rectBox = hitArea.getBoundingClientRect();
                const wrapperBox = performanceChartEl.parentElement.getBoundingClientRect();
                chartTooltipDate.textContent = hitArea.getAttribute('data-date');
                chartTooltipValue.textContent = hitArea.getAttribute('data-value');
                chartTooltip.style.left = `${rectBox.left - wrapperBox.left + rectBox.width / 2}px`;
                chartTooltip.style.top = `${rectBox.top - wrapperBox.top}px`;
                chartTooltip.classList.add('visible');
            };
            const hideTooltip = () => chartTooltip.classList.remove('visible');

            hitArea.addEventListener('pointerenter', showTooltip);
            hitArea.addEventListener('pointermove', showTooltip);
            hitArea.addEventListener('pointerleave', hideTooltip);
            hitArea.addEventListener('focus', showTooltip);
            hitArea.addEventListener('blur', hideTooltip);
        });

        if (performanceTableBody) {
            performanceTableBody.innerHTML = '';
            days.forEach((day, i) => {
                const value = values[i];
                const fullLabel = day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const valueLabel = isProfit ? formatBRL(value) : `${value}`;
                const tr = document.createElement('tr');
                const tdDate = document.createElement('td');
                tdDate.textContent = fullLabel;
                const tdValue = document.createElement('td');
                tdValue.textContent = valueLabel;
                tr.appendChild(tdDate);
                tr.appendChild(tdValue);
                performanceTableBody.appendChild(tr);
            });
        }

        if (performanceTableMetricLabel) {
            performanceTableMetricLabel.textContent = isProfit ? 'Lucro Líquido' : 'Vendas';
        }
    };

    if (chartMetricToggle) {
        chartMetricToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.chart-toggle-btn');
            if (!btn) return;
            currentChartMetric = btn.getAttribute('data-metric');
            chartMetricToggle.querySelectorAll('.chart-toggle-btn').forEach((b) => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-pressed', String(isActive));
            });
            renderPerformanceChart();
        });
    }

    if (btnToggleTable && performanceTableWrapper) {
        btnToggleTable.addEventListener('click', () => {
            const isHidden = performanceTableWrapper.classList.toggle('hidden');
            btnToggleTable.textContent = isHidden ? 'Ver como tabela' : 'Ocultar tabela';
        });
    }

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
                    saveProduct(product);

                    // Feedback visual temporário de sucesso na borda
                    e.target.style.borderColor = '#aaff00';
                    setTimeout(() => { e.target.style.borderColor = ''; }, 800);
                }
            } else if (e.target.classList.contains('inline-edit-price')) {
                const newPrice = e.target.value.trim();
                if (newPrice) {
                    product.price = newPrice;
                    saveProduct(product);

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
                        saveProduct(product);
                        registerSale(product);
                    } else {
                        alert('Estoque esgotado! Não é possível registrar venda deste item.');
                    }
                }
            } else if (e.target.classList.contains('btn-delete')) {
                // Excluir Anúncio
                if (confirm('Tem certeza que deseja excluir este anúncio definitivamente?')) {
                    deleteProductRemote(productId);
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
        btnResetSales.addEventListener('click', async () => {
            if (!confirm('Deseja realmente zerar todas as vendas e limpar os valores do dashboard? O estoque atual será mantido.')) {
                return;
            }
            await clearAllSales();
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
                    product.status = status;
                    if (loadedImageBase64) {
                        product.img = loadedImageBase64;
                    }
                    saveProduct(product);
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

                saveProduct(newProduct);
            }

            resetProductForm();
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

});
