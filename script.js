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

    // Produtos ficam salvos no Firestore (coleção "products") e sincronizados
    // em tempo real entre todos os dispositivos/abas — ver firebase-config.js
    const productsRef = db.collection('products');
    let products = [];

    productsRef.onSnapshot((snapshot) => {
        products = snapshot.docs.map((doc) => doc.data());
        renderStorefront();
        renderCartSidebar();
    });

    // Vendas (histórico) também ficam no Firestore, na coleção "sales".
    // O estoque só é descontado e a venda só é registrada no checkout (ver
    // o clique de "Enviar Pedido no WhatsApp" mais abaixo).
    const salesRef = db.collection('sales');

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

    // O carrinho é só uma "sacolinha" local — não desconta estoque nem registra
    // venda ao adicionar/remover. Isso só acontece de fato no checkout (WhatsApp),
    // então o estoque disponível pra adicionar é o que sobra descontando o que já
    // está na sacolinha de cada visitante.
    const getAvailableQty = (product) => {
        const inCart = cart.filter(id => id === product.id).length;
        return Math.max(0, (product.qty || 0) - inCart);
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
                // Adiciona mais um item à sacolinha (se houver estoque disponível)
                if (getAvailableQty(product) > 0) {
                    cart.push(productId);
                    saveCart();

                    renderCartSidebar();
                    updateCardStockUI(productId);
                } else {
                    alert('Limite de estoque atingido para este item!');
                }
            } else if (btn.classList.contains('btn-qty-minus')) {
                // Remove um item da sacolinha
                const index = cart.indexOf(productId);
                if (index > -1) {
                    cart.splice(index, 1);
                    saveCart();

                    renderCartSidebar();
                    updateCardStockUI(productId);
                }
            } else if (btn.classList.contains('btn-remove-item')) {
                // Remove todas as unidades deste item da sacolinha
                cart = cart.filter(id => id !== productId);
                saveCart();

                renderCartSidebar();
                updateCardStockUI(productId);
            }
        });
    }

    // Esvaziar Carrinho
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            if (confirm('Deseja realmente limpar todo o carrinho?')) {
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
        checkoutWppBtn.addEventListener('click', async () => {
            if (cart.length === 0) return;

            const grouped = getCartItemsGrouped();

            // Confere se o estoque ainda cobre o pedido (pode ter mudado desde que
            // os itens foram colocados na sacolinha) antes de confirmar a "venda".
            const insufficient = Object.keys(grouped)
                .map(productId => products.find(p => p.id === productId))
                .filter(product => product && product.qty < grouped[product.id]);

            if (insufficient.length > 0) {
                const names = insufficient.map(p => `"${p.name}" (restam ${p.qty})`).join(', ');
                alert(`Estoque insuficiente para: ${names}. Ajuste as quantidades no carrinho antes de continuar.`);
                renderCartSidebar();
                renderStorefront();
                return;
            }

            checkoutWppBtn.disabled = true;

            let itemsText = '';
            let grandTotal = 0;
            const batch = db.batch();

            Object.keys(grouped).forEach(productId => {
                const product = products.find(p => p.id === productId);
                if (!product) return;

                const qty = grouped[productId];
                const subtotal = parsePrice(product.price) * qty;
                grandTotal += subtotal;
                itemsText += `• *${qty}x ${product.name}* (R$ ${product.price}/un) - Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

                // Só agora (checkout de verdade) o estoque desconta e a venda é registrada
                batch.update(productsRef.doc(product.id), { qty: product.qty - qty });
                for (let i = 0; i < qty; i++) {
                    batch.set(salesRef.doc(), {
                        productId: product.id,
                        productName: product.name,
                        costPrice: parsePrice(product.costPrice || '80,00'),
                        salePrice: parsePrice(product.price),
                        timestamp: Date.now()
                    });
                }
            });

            try {
                await batch.commit();
            } catch (err) {
                console.error('Erro ao finalizar pedido:', err);
                alert('Não foi possível confirmar o pedido agora. Tente novamente em instantes.');
                checkoutWppBtn.disabled = false;
                return;
            }

            const formattedTotal = grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const message = `Olá RT SPORTS! Gostaria de finalizar a compra dos seguintes itens:\n\n⚽ *ITENS DO PEDIDO:*\n${itemsText}\n💰 *VALOR TOTAL:* R$ ${formattedTotal}\n\nPor favor, confirme a disponibilidade e me envie o link para entrega e pagamento!`;

            const encodedMsg = encodeURIComponent(message);
            const wppUrl = `https://wa.me/5517997765086?text=${encodedMsg}`;

            // Abre o whatsapp em nova aba
            window.open(wppUrl, '_blank');

            cart = [];
            saveCart();
            renderCartSidebar();
        });
    }

    // === Atualização Visual do Card (Estoque e Botão) ===
    const updateCardStockUI = (productId) => {
        const btn = document.querySelector(`.btn-add[data-id="${productId}"]`);
        if (!btn) return;

        const product = products.find(p => p.id === productId);
        const qty = product ? getAvailableQty(product) : 0;

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

        if (getAvailableQty(product) <= 0) {
            alert('Estoque esgotado!');
            pendingAddProductId = null;
            sizeOverlay?.classList.remove('active');
            sizeModal?.classList.remove('active');
            return;
        }

        cart.push(product.id);
        saveCart();
        updateCardStockUI(product.id);

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

            const whatsappNumber = '5517997765086';
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
