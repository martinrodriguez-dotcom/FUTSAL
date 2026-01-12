// Importaciones necesarias de Firestore
import { 
    getFirestore, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    query, 
    where, 
    onSnapshot, 
    getDocs, 
    Timestamp, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Inicializamos Firestore (Compartido con la app principal)
const db = getFirestore();

// --- CONFIGURACIÓN DE COLECCIONES ---
const COLLECTIONS = {
    PRODUCTS: "products",
    SALES: "sales",
    TRANSACTIONS: "product_transactions"
};

// --- ESTADO LOCAL ---
let allProducts = [];
let currentSelectedProduct = null;

// --- ELEMENTOS DEL DOM ---
const kioskElements = {
    productForm: document.getElementById('product-form'),
    productList: document.getElementById('product-list'),
    inventorySearch: document.getElementById('inventory-search-input'),
    restockModal: document.getElementById('restock-modal'),
    restockForm: document.getElementById('restock-form'),
    saleModal: document.getElementById('sale-modal'),
    saleSearchInput: document.getElementById('sale-search-input'),
    saleSearchResults: document.getElementById('sale-search-results'),
    selectedProductInfo: document.getElementById('selected-product-info'),
    confirmSaleBtn: document.getElementById('confirm-sale-btn'),
    saleQtyInput: document.getElementById('sale-qty-input'),
    saleTotalDisplay: document.getElementById('sale-total-display')
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupKioskEventListeners();
    syncProducts();
});

/**
 * Seteo de Listeners exclusivos de la sección Kiosco
 */
function setupKioskEventListeners() {
    // Alta de Producto
    if (kioskElements.productForm) {
        kioskElements.productForm.onsubmit = handleSaveProduct;
    }

    // Buscador de Inventario
    if (kioskElements.inventorySearch) {
        kioskElements.inventorySearch.oninput = (e) => renderProducts(e.target.value);
    }

    // Cálculos dinámicos de Precios (Bulto -> Unidad -> Margen)
    const priceInputs = ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'];
    priceInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = calculateSuggestedPrices;
    });

    // Lógica de Venta Rápida
    const headerSaleBtn = document.getElementById('header-sale-btn');
    if (headerSaleBtn) headerSaleBtn.onclick = openSaleModal;
    
    if (kioskElements.saleSearchInput) {
        kioskElements.saleSearchInput.oninput = handleSaleSearch;
    }

    const qtyMinus = document.getElementById('sale-qty-minus');
    const qtyPlus = document.getElementById('sale-qty-plus');
    if (qtyMinus) qtyMinus.onclick = () => updateSaleQty(-1);
    if (qtyPlus) qtyPlus.onclick = () => updateSaleQty(1);

    if (kioskElements.confirmSaleBtn) {
        kioskElements.confirmSaleBtn.onclick = handleConfirmSale;
    }

    // Reposición y Edición
    if (kioskElements.restockForm) {
        kioskElements.restockForm.onsubmit = handleConfirmRestock;
    }

    const editForm = document.getElementById('edit-product-form');
    if (editForm) editForm.onsubmit = handleConfirmEditProduct;
}

// --- LÓGICA DE COSTO DE REPOSICIÓN DIRECTO ---

/**
 * REPOSICIÓN DIRECTA:
 * Al ingresar stock nuevo, el costo de TODO el stock se actualiza al valor del lote nuevo.
 */
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    // Cálculo del nuevo costo unitario
    const newUnitCost = batchCost / addQty;
    
    // Obtenemos el producto actual para saber el stock previo y el margen
    const product = allProducts.find(p => p.id === id);
    const totalNewStock = product.stock + addQty;
    
    // Mantener el margen de ganancia porcentual que tenía el producto o aplicar el 40%
    const currentMargin = product.salePrice / product.unitCost;
    const newSalePrice = Math.ceil(newUnitCost * currentMargin);

    try {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
        await updateDoc(productRef, {
            stock: totalNewStock,
            unitCost: newUnitCost, // LÓGICA PEDIDA: Actualización directa al último precio
            salePrice: newSalePrice
        });

        await logTransaction(id, `Reposición (+${addQty} un.)`, addQty, newUnitCost, 'in');
        
        window.closeModals();
        alert(`Stock actualizado. Nuevo costo unitario: $${newUnitCost.toFixed(2)}`);
    } catch (err) {
        console.error("Error en reposición:", err);
    }
}

/**
 * Calcula sugerencia de precios mientras se escribe en el formulario de alta
 */
function calculateSuggestedPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost')?.value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty')?.value) || 1;
    const marginPct = parseFloat(document.getElementById('prod-profit-pct')?.value) || 40;
    
    const unitCost = cost / qty;
    const suggestedPrice = Math.ceil(unitCost * (1 + (marginPct / 100)));
    
    const display = document.getElementById('prod-suggested-price');
    if (display) display.textContent = `$${suggestedPrice}`;
    
    const hiddenCost = document.getElementById('prod-unit-cost');
    if (hiddenCost) hiddenCost.value = unitCost;
}

// --- GESTIÓN DE PRODUCTOS ---

async function handleSaveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value);
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value);
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
            name,
            stock,
            unitCost,
            salePrice,
            createdAt: Timestamp.now()
        });

        await logTransaction(docRef.id, 'Alta Inicial', stock, unitCost, 'in');
        
        e.target.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
    } catch (err) {
        console.error("Error al guardar producto:", err);
    }
}

function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(kioskElements.inventorySearch?.value || "");
    });
}

function renderProducts(filter = "") {
    if (!kioskElements.productList) return;
    kioskElements.productList.innerHTML = '';
    
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800 leading-tight">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} mt-1 inline-block text-[10px]">STOCK: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest">P. Venta</p>
                    <p class="text-2xl font-black text-emerald-600 tracking-tighter">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2 mt-2">
                <button class="card-action-btn bg-blue-50 text-blue-700" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn bg-gray-50 text-gray-700" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn bg-gray-50 text-gray-700" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn bg-red-50 text-red-500" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
            </div>
        `;
        kioskElements.productList.appendChild(card);
    });
}

// --- VENTA RÁPIDA ---

function openSaleModal() {
    kioskElements.saleSearchInput.value = '';
    kioskElements.saleSearchResults.innerHTML = '';
    kioskElements.selectedProductInfo.classList.add('is-hidden');
    kioskElements.confirmSaleBtn.disabled = true;
    kioskElements.saleModal.classList.add('is-open');
    setTimeout(() => kioskElements.saleSearchInput.focus(), 100);
}

function handleSaleSearch() {
    const val = kioskElements.saleSearchInput.value.toLowerCase();
    if (val.length < 2) { kioskElements.saleSearchResults.innerHTML = ''; return; }
    
    kioskElements.saleSearchResults.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(val)).forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 mb-2 transition-all border border-transparent hover:border-emerald-200';
        item.innerHTML = `
            <div>
                <span class="font-black text-gray-800">${p.name}</span>
                <p class="text-[10px] text-gray-400 font-bold uppercase">STOCK: ${p.stock}</p>
            </div>
            <strong class="text-emerald-600 text-lg">$${p.salePrice}</strong>
        `;
        item.onclick = () => selectProductForSale(p);
        kioskElements.saleSearchResults.appendChild(item);
    });
}

function selectProductForSale(p) {
    currentSelectedProduct = p;
    document.getElementById('sel-prod-name').textContent = p.name;
    document.getElementById('sel-prod-stock').textContent = p.stock;
    document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
    kioskElements.saleQtyInput.value = 1;
    
    kioskElements.selectedProductInfo.classList.remove('is-hidden');
    kioskElements.confirmSaleBtn.disabled = (p.stock <= 0);
    updateSaleTotal();
}

function updateSaleQty(delta) {
    let val = parseInt(kioskElements.saleQtyInput.value) + delta;
    if (val < 1) val = 1;
    if (val > currentSelectedProduct.stock) val = currentSelectedProduct.stock;
    kioskElements.saleQtyInput.value = val;
    updateSaleTotal();
}

function updateSaleTotal() {
    const qty = parseInt(kioskElements.saleQtyInput.value);
    const total = qty * currentSelectedProduct.salePrice;
    kioskElements.saleTotalDisplay.textContent = `$${total.toLocaleString('es-AR')}`;
}

async function handleConfirmSale() {
    const qty = parseInt(kioskElements.saleQtyInput.value);
    const total = qty * currentSelectedProduct.salePrice;
    
    try {
        // 1. Registrar la venta
        await addDoc(collection(db, COLLECTIONS.SALES), {
            name: currentSelectedProduct.name,
            qty: qty,
            total: total,
            day: new Date().toISOString().split('T')[0],
            monthYear: new Date().toISOString().substring(0, 7),
            timestamp: Timestamp.now()
        });

        // 2. Descontar stock
        const productRef = doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id);
        await updateDoc(productRef, {
            stock: currentSelectedProduct.stock - qty
        });

        // 3. Registrar Log
        await logTransaction(currentSelectedProduct.id, 'Venta Kiosco', qty, currentSelectedProduct.unitCost, 'out');

        window.closeModals();
        alert("Venta registrada con éxito.");
    } catch (err) {
        console.error("Error al cobrar:", err);
    }
}

// --- UTILIDADES Y LOGS ---

async function logTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), {
        productId,
        desc,
        qty,
        cost,
        type, // 'in' (ingreso), 'out' (venta), 'adj' (ajuste)
        timestamp: Timestamp.now()
    });
}

// Inyección de funciones en el objeto window para botones dinámicos
window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('restock-prod-id').value = id;
    document.getElementById('restock-name').textContent = p.name;
    document.getElementById('restock-current-stock').textContent = p.stock;
    kioskElements.restockModal.classList.add('is-open');
};

window.openEditProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('edit-prod-id').value = id;
    document.getElementById('edit-prod-name').value = p.name;
    document.getElementById('edit-prod-cost').value = p.unitCost;
    document.getElementById('edit-prod-price').value = p.salePrice;
    document.getElementById('edit-prod-stock').value = p.stock;
    document.getElementById('edit-product-modal').classList.add('is-open');
};

async function handleConfirmEditProduct(e) {
    e.preventDefault();
    const id = document.getElementById('edit-prod-id').value;
    const data = {
        name: document.getElementById('edit-prod-name').value,
        unitCost: parseFloat(document.getElementById('edit-prod-cost').value),
        salePrice: parseFloat(document.getElementById('edit-prod-price').value),
        stock: parseInt(document.getElementById('edit-prod-stock').value)
    };
    await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), data);
    await logTransaction(id, 'Ajuste Manual', 0, data.unitCost, 'adj');
    window.closeModals();
}

window.deleteProduct = async (id) => {
    if (confirm("¿Eliminar este producto permanentemente?")) {
        await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
    }
};

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const list = document.getElementById('product-history-list');
    list.innerHTML = '<p class="text-center p-4">Cargando bitácora...</p>';
    
    const q = query(collection(db, COLLECTIONS.TRANSACTIONS), where("productId", "==", id), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    if (snap.empty) list.innerHTML = '<p class="text-gray-400 text-center">Sin movimientos registrados.</p>';
    
    snap.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const item = document.createElement('div');
        item.className = 'history-item flex justify-between items-center p-4 bg-gray-50 rounded-2xl border-l-4 ' + 
                         (t.type === 'in' ? 'border-emerald-500' : t.type === 'out' ? 'border-red-500' : 'border-blue-500');
        item.innerHTML = `
            <div>
                <p class="font-black text-gray-800 text-sm">${t.desc}</p>
                <p class="text-[9px] font-bold text-gray-400 uppercase">${date}</p>
            </div>
            <div class="text-right">
                <p class="font-black ${t.type === 'in' ? 'text-emerald-600' : 'text-red-500'}">${t.type === 'in' ? '+' : '-'}${t.qty}</p>
                <p class="text-[9px] font-bold text-gray-300">$${t.cost.toFixed(2)}/u</p>
            </div>
        `;
        list.appendChild(item);
    });
    document.getElementById('product-history-modal').classList.add('is-open');
};

console.log("Kiosco e Inventario cargado correctamente.");
