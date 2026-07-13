document.addEventListener('DOMContentLoaded', () => {
    // === Menu Mobile Toggle ===
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            
            // Acessibilidade: atualiza aria-expanded
            const isExpanded = menuToggle.classList.contains('active');
            menuToggle.setAttribute('aria-expanded', isExpanded);
        });

        // Fechar menu ao clicar em um link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // === Sistema de Banco de Dados Unificado (Sincronizado via LocalStorage) ===
    const seedProducts = [
        { id: '1', name: 'Camiseta Clube Azul - Modelo Principal', price: '189,90', costPrice: '80,00', qty: 10, size: 'M', img: 'https://images.unsplash.com/photo-1583332468351-4ad90b21dfc6?w=260&h=260&fit=crop&q=80' },
        { id: '2', name: 'Camiseta Time Estrela - Modelo Away', price: '189,90', costPrice: '80,00', qty: 10, size: 'P', img: 'https://images.unsplash.com/photo-1558914611-c9172202bb91?w=260&h=260&fit=crop&q=80' },
        { id: '3', name: 'Camiseta Dragão FC - Edição Limitada', price: '219,90', costPrice: '90,00', qty: 10, size: 'G', img: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=260&h=260&fit=crop&q=80' },
        { id: '4', name: 'Camiseta Leão Clube - Retrô', price: '199,90', costPrice: '85,00', qty: 10, size: 'GG', img: 'https://images.unsplash.com/photo-1628100589886-444733db9b89?w=260&h=260&fit=crop&q=80' },
        { id: '5', name: 'Camiseta Aço United - 2026', price: '179,90', costPrice: '75,00', qty: 10, size: 'PP', img: 'https://images.unsplash.com/photo-1622359405626-d15f7f32997e?w=260&h=260&fit=crop&q=80' },
        { id: '6', name: 'Camiseta Fênix FC - Aquecimento', price: '149,90', costPrice: '60,00', qty: 10, size: 'M', img: 'https://images.unsplash.com/photo-1596706950274-122904c6a992?w=260&h=260&fit=crop&q=80' },
        { id: '7', name: 'Camiseta Trovão City - Goleiro', price: '189,90', costPrice: '80,00', qty: 10, size: 'P', img: 'https://images.unsplash.com/photo-1586221151604-51a8eb8d5f30?w=260&h=260&fit=crop&q=80' },
        { id: '8', name: 'Camiseta Atlético Real - Terceira', price: '199,90', costPrice: '85,00', qty: 10, size: 'G', img: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=260&h=260&fit=crop&q=80' }
    ];

    // Produtos ficam salvos no Firestore (coleção "products") e sincronizados
    // em tempo real entre todos os dispositivos/abas — ver firebase-config.js
    const productsRef = db.collection('products');
    let products = seedProducts;

    const seedProductsIfEmpty = async () => {
        const snapshot = await productsRef.limit(1).get();
        if (snapshot.empty) {
            const batch = db.batch();
            seedProducts.forEach((product) => batch.set(productsRef.doc(product.id), product));
            await batch.commit();
        }
    };
    seedProductsIfEmpty();

    productsRef.onSnapshot((snapshot) => {
        if (!snapshot.empty) {
            products = snapshot.docs.map((doc) => doc.data());
        }
        renderStorefront();
        renderCartSidebar();
    });

    const saveProduct = (product) => {
        productsRef.doc(product.id).set(product).catch((err) => console.error('Erro ao salvar produto:', err));
    };

    // Vendas (histórico) também ficam no Firestore, na coleção "sales"
    const salesRef = db.collection('sales');
    const registerSale = (product) => {
        salesRef.add({
            productId: product.id,
            productName: product.name,
            costPrice: parsePrice(product.costPrice || '80,00'),
            salePrice: parsePrice(product.price),
            timestamp: Date.now()
        }).catch((err) => console.error('Erro ao registrar venda:', err));
    };

    // === Utilitários de Parse Financeiro ===
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

    // === SISTEMA DE CARRINHO DE COMPRAS E SIDEBAR ===
    const cartCountElement = document.getElementById('cart-count');
    const cartBtn = document.querySelector('.cart');
    const cartSidebar = document.getElementById('cart-sidebar');
    const aboutBtns = document.querySelectorAll('.about-btn');
    const aboutSidebar = document.getElementById('about-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    const closeCartBtn = document.getElementById('close-cart');
    const closeAboutBtn = document.getElementById('close-about');
    const cartItemsContainer = document.getElementById('cart-sidebar-items');
    const cartTotalPriceElement = document.getElementById('cart-total-price');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const checkoutWppBtn = document.getElementById('btn-checkout-wpp');
    const sizeOverlay = document.getElementById('size-overlay');
    const sizeModal = document.getElementById('size-modal');
    const sizeSelect = document.getElementById('size-select');
    const confirmSizeBtn = document.getElementById('confirm-size-btn');
    const cancelSizeBtn = document.getElementById('cancel-size-btn');
    let pendingAddProductId = null;

    let cart = JSON.parse(localStorage.getItem('camisetas_fc_cart')) || [];

    const updateCartCount = () => {
        if (cartCountElement) {
            cartCountElement.textContent = cart.length;
        }
    };

    const saveCart = () => {
        localStorage.setItem('camisetas_fc_cart', JSON.stringify(cart));
        updateCartCount();
    };

    // Agrupar itens do carrinho por ID para calcular quantidade
    const getCartItemsGrouped = () => {
        const grouped = {};
        cart.forEach(id => {
            grouped[id] = (grouped[id] || 0) + 1;
        });
        return grouped;
    };

    // Abrir/Fechar Carrinho
    const closeSidebar = () => {
        cartSidebar?.classList.remove('active');
        aboutSidebar?.classList.remove('active');
        cartOverlay?.classList.remove('active');
    };

    if (cartBtn && cartSidebar && cartOverlay) {
        cartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            aboutSidebar?.classList.remove('active');
            cartSidebar.classList.add('active');
            cartOverlay.classList.add('active');
            renderCartSidebar();
        });
    }

    if (aboutBtns.length > 0 && aboutSidebar && cartOverlay) {
        aboutBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                cartSidebar?.classList.remove('active');
                aboutSidebar.classList.add('active');
                cartOverlay.classList.add('active');
            });
        });
    }

    if (closeCartBtn && closeAboutBtn && cartOverlay && cartSidebar && aboutSidebar) {
        closeCartBtn.addEventListener('click', closeSidebar);
        closeAboutBtn.addEventListener('click', closeSidebar);
        cartOverlay.addEventListener('click', closeSidebar);
    }

    // Renderizar itens no carrinho lateral
    const renderCartSidebar = () => {
        if (!cartItemsContainer || !cartTotalPriceElement) return;
        cartItemsContainer.innerHTML = '';

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 3rem;">Seu carrinho está vazio.</div>';
            cartTotalPriceElement.textContent = 'R$ 0,00';
            if (checkoutWppBtn) checkoutWppBtn.disabled = true;
            return;
        }

        if (checkoutWppBtn) checkoutWppBtn.disabled = false;

        const grouped = getCartItemsGrouped();
        let grandTotal = 0;

        Object.keys(grouped).forEach(productId => {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            const quantity = grouped[productId];
            const priceVal = parsePrice(product.price);
            const subtotal = priceVal * quantity;
            grandTotal += subtotal;

            const row = document.createElement('div');
            row.className = 'cart-item-row';
            row.innerHTML = `
                <img src="${product.img}" alt="${product.name}">
                <div class="cart-item-info">
                    <span class="cart-item-name">${product.name}</span>
                    <span class="cart-item-price">R$ ${product.price}</span>
                </div>
                <div class="cart-item-controls">
                    <button class="cart-item-btn btn-qty-minus" data-id="${product.id}">-</button>
                    <span class="cart-item-qty">${quantity}</span>
                    <button class="cart-item-btn btn-qty-plus" data-id="${product.id}">+</button>
                </div>
                <button class="btn-remove-item" data-id="${product.id}" aria-label="Remover item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;
            cartItemsContainer.appendChild(row);
        });

        cartTotalPriceElement.textContent = `R$ ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Controle de Cliques no Carrinho Lateral (Ajustar Qtd ou Remover)
    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const productId = btn.getAttribute('data-id');
            const product = products.find(p => p.id === productId);
            if (!product) return;

            if (btn.classList.contains('btn-qty-plus')) {
                // Adiciona mais um item ao carrinho (se houver estoque)
                if (product.qty > 0) {
                    product.qty -= 1;
                    saveProduct(product);

                    cart.push(productId);
                    saveCart();

                    registerSale(product);

                    renderCartSidebar();
                    renderStorefront();
                } else {
                    alert('Limite de estoque atingido para este item!');
                }
            } else if (btn.classList.contains('btn-qty-minus')) {
                // Remove um item do carrinho e devolve para o estoque
                const index = cart.indexOf(productId);
                if (index > -1) {
                    cart.splice(index, 1);
                    saveCart();

                    product.qty += 1;
                    saveProduct(product);

                    renderCartSidebar();
                    renderStorefront();
                }
            } else if (btn.classList.contains('btn-remove-item')) {
                // Devolve todas as unidades deste item no carrinho de volta ao estoque
                const grouped = getCartItemsGrouped();
                const quantityInCart = grouped[productId] || 0;

                cart = cart.filter(id => id !== productId);
                saveCart();

                product.qty += quantityInCart;
                saveProduct(product);

                renderCartSidebar();
                renderStorefront();
            }
        });
    }

    // Esvaziar Carrinho
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            if (confirm('Deseja realmente limpar todo o carrinho?')) {
                // Devolve as unidades para o estoque
                const grouped = getCartItemsGrouped();
                Object.keys(grouped).forEach(productId => {
                    const product = products.find(p => p.id === productId);
                    if (product) {
                        product.qty += grouped[productId];
                        saveProduct(product);
                    }
                });

                cart = [];
                saveCart();

                renderCartSidebar();
                renderStorefront();
                
                // Fecha o carrinho
                cartSidebar.classList.remove('active');
                cartOverlay.classList.remove('active');
            }
        });
    }

    // Enviar Pedido no WhatsApp (Checkout)
    if (checkoutWppBtn) {
        checkoutWppBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            const grouped = getCartItemsGrouped();
            let itemsText = '';
            let grandTotal = 0;

            Object.keys(grouped).forEach(productId => {
                const product = products.find(p => p.id === productId);
                if (product) {
                    const qty = grouped[productId];
                    const subtotal = parsePrice(product.price) * qty;
                    grandTotal += subtotal;
                    itemsText += `• *${qty}x ${product.name}* (R$ ${product.price}/un) - Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                }
            });

            const formattedTotal = grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const message = `Olá RT SPORTS! Gostaria de finalizar a compra dos seguintes itens:\n\n⚽ *ITENS DO PEDIDO:*\n${itemsText}\n💰 *VALOR TOTAL:* R$ ${formattedTotal}\n\nPor favor, confirme a disponibilidade e me envie o link para entrega e pagamento!`;

            const encodedMsg = encodeURIComponent(message);
            const wppUrl = `https://wa.me/5517996041562?text=${encodedMsg}`;

            // Abre o whatsapp em nova aba
            window.open(wppUrl, '_blank');
        });
    }

    // === Atualização Visual do Card (Estoque e Botão) ===
    const updateCardStockUI = (productId) => {
        const btn = document.querySelector(`.btn-add[data-id="${productId}"]`);
        if (!btn) return;

        const product = products.find(p => p.id === productId);
        const qty = product ? product.qty : 0;

        if (qty > 0) {
            btn.disabled = false;
            btn.textContent = 'Adicionar';
        } else {
            btn.disabled = true;
            btn.textContent = 'Indisponível';
        }
    };

    // === Adicionar ao Carrinho na Vitrine ===
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-add')) {
            const productId = e.target.getAttribute('data-id');

            pendingAddProductId = productId;
            if (sizeSelect) sizeSelect.value = '';
            if (sizeOverlay) sizeOverlay.classList.add('active');
            if (sizeModal) sizeModal.classList.add('active');
        }
    });

    // === Renderização Dinâmica da Vitrine ===
    const produtosContainer = document.getElementById('produtos-container');

    const renderStorefront = () => {
        if (!produtosContainer) return;
        produtosContainer.innerHTML = '';

        products.forEach(product => {
            const isPreOrder = product.status === 'Encomenda';
            const statusText = isPreOrder ? 'Sob encomenda' : 'Disponivel';

            const cardArticle = document.createElement('article');
            cardArticle.className = 'card';
            cardArticle.innerHTML = `
                <div class="card-image">
                    <img src="${product.img}" alt="${product.name}">
                </div>
                <div class="card-info">
                    <h2 class="produto-nome">${product.name}</h2>
                    <p class="produto-preco">R$ ${product.price}</p>
                    <p class="produto-status ${isPreOrder ? 'pre-order' : 'available'}">${statusText}</p>
                    <button class="btn-add" data-id="${product.id}">Adicionar</button>
                </div>
            `;
            produtosContainer.appendChild(cardArticle);
            updateCardStockUI(product.id);
        });
    };

    confirmSizeBtn?.addEventListener('click', () => {
        const selectedSize = sizeSelect ? sizeSelect.value : '';
        if (!selectedSize) {
            alert('Por favor, selecione um tamanho.');
            return;
        }

        if (!pendingAddProductId) {
            return;
        }

        const product = products.find(p => p.id === pendingAddProductId);
        if (!product) {
            alert('Produto não encontrado.');
            pendingAddProductId = null;
            sizeOverlay?.classList.remove('active');
            sizeModal?.classList.remove('active');
            return;
        }

        if (product.qty <= 0) {
            alert('Estoque esgotado!');
            pendingAddProductId = null;
            sizeOverlay?.classList.remove('active');
            sizeModal?.classList.remove('active');
            return;
        }

        product.qty -= 1;
        saveProduct(product);
        updateCardStockUI(product.id);

        registerSale(product);

        cart.push(product.id);
        saveCart();

        pendingAddProductId = null;
        sizeOverlay?.classList.remove('active');
        sizeModal?.classList.remove('active');
        renderStorefront();
        updateCardStockUI(product.id);
    });

    cancelSizeBtn?.addEventListener('click', () => {
        pendingAddProductId = null;
        sizeOverlay?.classList.remove('active');
        sizeModal?.classList.remove('active');
    });

    sizeOverlay?.addEventListener('click', () => {
        pendingAddProductId = null;
        sizeOverlay.classList.remove('active');
        sizeModal?.classList.remove('active');
    });

    // === Formulário de Contato ===
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');

    if (contactForm && contactStatus) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const subject = document.getElementById('contact-subject').value.trim();
            const message = document.getElementById('contact-message').value.trim();

            if (!name || !email || !subject || !message) {
                contactStatus.style.color = '#ff3b30';
                contactStatus.textContent = 'Por favor, preencha todos os campos antes de enviar.';
                return;
            }

            const whatsappNumber = '5517996041562';
            const whatsappText = encodeURIComponent(
                `Olá, meu nome é ${name}.\n` +
                `Email: ${email}.\n` +
                `Assunto: ${subject}.\n` +
                `Mensagem: ${message}`
            );
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

            contactStatus.style.color = 'var(--cor-secundaria)';
            contactStatus.textContent = 'Abrindo WhatsApp com sua mensagem...';

            window.open(whatsappUrl, '_blank');
            contactForm.reset();

            setTimeout(() => {
                contactStatus.textContent = '';
            }, 6000);
        });
    }

    // === Inicialização da Vitrine ===
    renderStorefront();
    updateCartCount();

    // Sincroniza vitrine se voltar de outra aba onde alterou o estoque
    window.addEventListener('focus', () => {
        renderStorefront();
        updateCartCount();
        if (cartSidebar.classList.contains('active')) {
            renderCartSidebar();
        }
    });
});
