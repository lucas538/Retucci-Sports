document.addEventListener('DOMContentLoaded', () => {
    // === Menu Mobile Toggle ===
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');

            const isExpanded = menuToggle.classList.contains('active');
            menuToggle.setAttribute('aria-expanded', isExpanded);
        });

        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // === Produto desta página (lido da URL: anuncio.html?id=xxx) ===
    const productId = new URLSearchParams(window.location.search).get('id');

    // Produtos ficam salvos no Firestore (coleção "products") e sincronizados
    // em tempo real — a coleção inteira é assinada (não só este produto) porque
    // o carrinho lateral pode ter itens de outros anúncios também.
    const productsRef = db.collection('products');
    let products = [];

    productsRef.onSnapshot((snapshot) => {
        products = snapshot.docs.map((doc) => doc.data());
        renderProductDetail();
        renderCartSidebar();
        renderRelatedProducts();
    });

    // Vendas (histórico) também ficam no Firestore. O estoque só é descontado e
    // a venda só é registrada no checkout (ver "Enviar Pedido no WhatsApp" abaixo).
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

    const getProductImages = (product) => (Array.isArray(product.images) && product.images.length > 0)
        ? product.images
        : [product.img];

    // === SISTEMA DE CARRINHO DE COMPRAS E SIDEBAR (compartilhado com a loja) ===
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

    const getCartItemsGrouped = () => {
        const grouped = {};
        cart.forEach(id => {
            grouped[id] = (grouped[id] || 0) + 1;
        });
        return grouped;
    };

    // O carrinho é só uma "sacolinha" local — não desconta estoque nem registra
    // venda ao adicionar/remover. Isso só acontece de fato no checkout (WhatsApp).
    // Itens "sob encomenda" são feitos por pedido, então não têm limite de estoque físico.
    const getAvailableQty = (product) => {
        if (product.status === 'Encomenda') return Infinity;
        const inCart = cart.filter(id => id === product.id).length;
        return Math.max(0, (product.qty || 0) - inCart);
    };

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

        Object.keys(grouped).forEach(id => {
            const product = products.find(p => p.id === id);
            if (!product) return;

            const quantity = grouped[id];
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

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const id = btn.getAttribute('data-id');
            const product = products.find(p => p.id === id);
            if (!product) return;

            if (btn.classList.contains('btn-qty-plus')) {
                if (getAvailableQty(product) > 0) {
                    cart.push(id);
                    saveCart();
                    renderCartSidebar();
                } else {
                    alert('Limite de estoque atingido para este item!');
                }
            } else if (btn.classList.contains('btn-qty-minus')) {
                const index = cart.indexOf(id);
                if (index > -1) {
                    cart.splice(index, 1);
                    saveCart();
                    renderCartSidebar();
                }
            } else if (btn.classList.contains('btn-remove-item')) {
                cart = cart.filter(cid => cid !== id);
                saveCart();
                renderCartSidebar();
            }
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (cart.length === 0) return;

            if (confirm('Deseja realmente limpar todo o carrinho?')) {
                cart = [];
                saveCart();
                renderCartSidebar();
                cartSidebar.classList.remove('active');
                cartOverlay.classList.remove('active');
            }
        });
    }

    // Enviar Pedido no WhatsApp (Checkout) — só aqui o estoque desconta e a venda é registrada
    if (checkoutWppBtn) {
        checkoutWppBtn.addEventListener('click', async () => {
            if (cart.length === 0) return;

            const grouped = getCartItemsGrouped();

            const insufficient = Object.keys(grouped)
                .map(id => products.find(p => p.id === id))
                .filter(product => product && product.status !== 'Encomenda' && product.qty < grouped[product.id]);

            if (insufficient.length > 0) {
                const names = insufficient.map(p => `"${p.name}" (restam ${p.qty})`).join(', ');
                alert(`Estoque insuficiente para: ${names}. Ajuste as quantidades no carrinho antes de continuar.`);
                renderCartSidebar();
                renderProductDetail();
                return;
            }

            checkoutWppBtn.disabled = true;

            let itemsText = '';
            let grandTotal = 0;
            const batch = db.batch();

            Object.keys(grouped).forEach(id => {
                const product = products.find(p => p.id === id);
                if (!product) return;

                const qty = grouped[id];
                const subtotal = parsePrice(product.price) * qty;
                grandTotal += subtotal;
                itemsText += `• *${qty}x ${product.name}* (R$ ${product.price}/un) - Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

                // Itens sob encomenda não têm estoque físico pra descontar
                if (product.status !== 'Encomenda') {
                    batch.update(productsRef.doc(product.id), { qty: product.qty - qty });
                }
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

            window.open(wppUrl, '_blank');

            cart = [];
            saveCart();
            renderCartSidebar();
        });
    }

    // === Página do Anúncio: todas as fotos já abertas em mosaico + descrição + tamanho ===
    const adPageContent = document.getElementById('ad-page-content');
    const adPageNotFound = document.getElementById('ad-page-not-found');
    const adPageGallery = document.getElementById('ad-page-gallery');
    const adPageName = document.getElementById('ad-page-name');
    const adPagePrice = document.getElementById('ad-page-price');
    const adPageStatus = document.getElementById('ad-page-status');
    const adPageDescription = document.getElementById('ad-page-description');
    const adPageSizeOptions = document.getElementById('ad-page-size-options');
    const adPageQtyMinus = document.getElementById('ad-page-qty-minus');
    const adPageQtyPlus = document.getElementById('ad-page-qty-plus');
    const adPageQtyValue = document.getElementById('ad-page-qty-value');
    const adPageAddBtn = document.getElementById('ad-page-add-btn');
    const adPageFeedback = document.getElementById('ad-page-feedback');

    let selectedSize = '';
    let selectedQty = 1;

    if (adPageSizeOptions) {
        adPageSizeOptions.addEventListener('click', (e) => {
            const btn = e.target.closest('.size-option-btn');
            if (!btn) return;

            selectedSize = btn.getAttribute('data-size');
            adPageSizeOptions.querySelectorAll('.size-option-btn').forEach((b) => {
                b.classList.toggle('selected', b === btn);
            });
        });
    }

    // Quantidade: limitada ao estoque disponível — mas itens "sob encomenda" são
    // feitos por pedido, então getAvailableQty já retorna Infinity pra eles.
    const getCurrentProduct = () => products.find(p => p.id === productId);

    const updateQtyStepper = () => {
        if (!adPageQtyValue) return;
        const product = getCurrentProduct();
        const maxQty = product ? getAvailableQty(product) : 0;

        selectedQty = Math.max(1, Math.min(selectedQty, maxQty || 1));
        adPageQtyValue.textContent = selectedQty;

        if (adPageQtyMinus) adPageQtyMinus.disabled = selectedQty <= 1;
        if (adPageQtyPlus) adPageQtyPlus.disabled = selectedQty >= maxQty;
    };

    if (adPageQtyMinus) {
        adPageQtyMinus.addEventListener('click', () => {
            if (selectedQty > 1) {
                selectedQty -= 1;
                updateQtyStepper();
            }
        });
    }

    if (adPageQtyPlus) {
        adPageQtyPlus.addEventListener('click', () => {
            const product = getCurrentProduct();
            const maxQty = product ? getAvailableQty(product) : 0;
            if (selectedQty < maxQty) {
                selectedQty += 1;
                updateQtyStepper();
            }
        });
    }

    const renderProductDetail = () => {
        if (!adPageContent || !adPageNotFound) return;

        const product = productId ? products.find(p => p.id === productId) : null;

        if (!product) {
            adPageContent.classList.add('hidden');
            adPageNotFound.classList.remove('hidden');
            return;
        }

        adPageContent.classList.remove('hidden');
        adPageNotFound.classList.add('hidden');

        const images = getProductImages(product);
        adPageGallery.classList.toggle('single-photo', images.length === 1);
        adPageGallery.innerHTML = images
            .map((src, i) => `<img src="${src}" alt="${product.name} — foto ${i + 1}">`)
            .join('');

        const isPreOrder = product.status === 'Encomenda';
        adPageName.textContent = product.name;
        adPagePrice.textContent = `R$ ${product.price}`;
        adPageStatus.textContent = isPreOrder ? 'Sob encomenda' : 'Disponível';
        adPageStatus.className = `ad-page-status ${isPreOrder ? 'pre-order' : 'available'}`;
        adPageDescription.textContent = product.description || '';

        document.title = `${product.name} — RT SPORTS`;

        updateQtyStepper();
    };

    // === Outros Anúncios (todos os produtos, exceto o que está sendo visto) ===
    const relatedProductsGrid = document.getElementById('related-products-grid');

    const renderRelatedProducts = () => {
        if (!relatedProductsGrid) return;

        const others = products.filter(p => p.id !== productId);

        if (others.length === 0) {
            relatedProductsGrid.innerHTML = '<p style="color: #666; font-size: 0.85rem;">Nenhum outro anúncio no momento.</p>';
            return;
        }

        relatedProductsGrid.innerHTML = others.map(product => {
            const images = getProductImages(product);
            return `
                <a class="related-card" href="anuncio.html?id=${encodeURIComponent(product.id)}">
                    <img src="${images[0]}" alt="${product.name}">
                    <span class="related-card-name">${product.name}</span>
                    <span class="related-card-price">R$ ${product.price}</span>
                </a>
            `;
        }).join('');
    };

    if (adPageAddBtn) {
        adPageAddBtn.addEventListener('click', () => {
            const product = products.find(p => p.id === productId);
            if (!product) return;

            if (!selectedSize) {
                adPageFeedback.style.color = '#ef5350';
                adPageFeedback.textContent = 'Selecione um tamanho antes de adicionar.';
                return;
            }

            if (getAvailableQty(product) < selectedQty) {
                adPageFeedback.style.color = '#ef5350';
                adPageFeedback.textContent = 'Estoque insuficiente para essa quantidade.';
                return;
            }

            for (let i = 0; i < selectedQty; i++) {
                cart.push(product.id);
            }
            saveCart();

            selectedQty = 1;
            updateQtyStepper();

            adPageFeedback.style.color = '#aaff00';
            adPageFeedback.textContent = 'Adicionado ao carrinho! Continue navegando ou abra o carrinho para finalizar.';
        });
    }

    updateCartCount();
});
