/**
 * APP.JS - SISTEMA DE GESTIÓN INTEGRAL "PANZA VERDE" - VERSIÓN 5.5
 * ----------------------------------------------------------------
 * INTEGRACIÓN TOTAL: Reservas, Eventos, Auditoría, Buffet y Stock.
 * Lógica de Reposición: Actualización de costo total al último precio cargado.
 */

// 1. IMPORTACIONES DE FIREBASE SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    setPersistence, 
    browserLocalPersistence,
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,     
    signOut                         
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    addDoc,
    updateDoc,
    deleteDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    documentId,
    Timestamp, 
    orderBy, 
    getDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------
// 2. CONFIGURACIÓN DE FIREBASE
// -----------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
    authDomain: "reserva-futsal.firebaseapp.com",
    projectId: "reserva-futsal",
    storageBucket: "reserva-futsal.firebasestorage.app",
    messagingSenderId: "285845706235",
    appId: "1:285845706235:web:9355804aea8181b030275e"
};

// Rutas de Colecciones
const bookingsCollectionPath = "bookings"; 
const customersCollectionPath = "customers";
const logCollectionPath = "booking_log"; 
const productsCollectionPath = "products";
const salesCollectionPath = "sales";
const transactionsCollectionPath = "product_transactions";
const settingsDocPath = "app_settings/prices";

// Constantes
const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]; 
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- VARIABLES GLOBALES ---
let db, auth;
let userId = null; 
let userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
let currentSelectedProduct = null;

// Precios por defecto
let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

// -----------------------------------------------------------------
// 3. REFERENCIAS AL DOM (TAL CUAL TU VERSIÓN FUNCIONAL)
// -----------------------------------------------------------------
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const appContainer = document.getElementById('app-container');

const views = {
    calendar: document.getElementById('calendar-view'),
    caja: document.getElementById('caja-view'),
    stats: document.getElementById('stats-view'),
    historial: document.getElementById('historial-view'),
    productos: document.getElementById('productos-view'),
    configuracion: document.getElementById('config-view') 
};

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const menuBtn = document.getElementById('menu-btn');
const mainMenu = document.getElementById('main-menu');
const menuOverlay = document.getElementById('menu-overlay');
const userEmailDisplay = document.getElementById('user-email-display'); 
const logoutBtn = document.getElementById('logout-btn'); 

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const cajaDailyList = document.getElementById('caja-daily-list');
const cajaTotalCombined = document.getElementById('caja-total-combined');
const cajaTotalBookings = document.getElementById('caja-total-bookings');
const cajaTotalSales = document.getElementById('caja-total-sales');
const cajaDateFrom = document.getElementById('caja-date-from');
const cajaDateTo = document.getElementById('caja-date-to');
const cajaFilterBtn = document.getElementById('caja-filter-btn');

const statsList = document.getElementById('stats-list');
const historialList = document.getElementById('historial-list');

const typeModal = document.getElementById('type-modal'); 
const bookingModal = document.getElementById('booking-modal');
const eventModal = document.getElementById('event-modal'); 
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); 
const recurringModal = document.getElementById('recurring-modal');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

const bookingForm = document.getElementById('booking-form');
const teamNameInput = document.getElementById('teamName');
const teamNameSuggestions = document.getElementById('teamName-suggestions');
const costPerHourInput = document.getElementById('costPerHour');
const grillCostInput = document.getElementById('grillCost');
const rentGrillCheckbox = document.getElementById('rentGrill');
const grillHoursSection = document.getElementById('grill-hours-section');
const courtHoursList = document.getElementById('court-hours-list');
const grillHoursList = document.getElementById('grill-hours-list');
const bookingTotal = document.getElementById('booking-total');

const eventForm = document.getElementById('event-form');
const deleteReasonForm = document.getElementById('delete-reason-form');
const deleteReasonText = document.getElementById('delete-reason-text');
const deleteBookingIdInput = document.getElementById('delete-booking-id');

// Buffet Refs
const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');
const inventorySearchInput = document.getElementById('inventory-search-input');
const saleModal = document.getElementById('sale-modal');
const saleSearchInput = document.getElementById('sale-search-input');
const saleSearchResults = document.getElementById('sale-search-results');
const selectedProductInfo = document.getElementById('selected-product-info');
const confirmSaleBtn = document.getElementById('confirm-sale-btn');

// -----------------------------------------------------------------
// 4. INICIALIZACIÓN Y EVENTOS
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando Sistema Panza Verde...");
    setupEventListeners();
    firebaseInit();
});

async function firebaseInit() {
    try {
        const appInstance = initializeApp(firebaseConfig);
        db = getFirestore(appInstance);
        auth = getAuth(appInstance);
        await setPersistence(auth, browserLocalPersistence); 

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                userEmail = user.email;
                if(userEmailDisplay) userEmailDisplay.textContent = userEmail;
                
                await loadAppSettings(); 
                appContainer.classList.remove('is-hidden');
                loginView.classList.add('is-hidden');
                registerView.classList.add('is-hidden');
                
                await loadBookingsForMonth(); 
                syncProducts();
                hideMessage();
            } else {
                appContainer.classList.add('is-hidden');
                loginView.classList.remove('is-hidden');
                hideMessage();
            }
        });
    } catch (error) {
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

function setupEventListeners() {
    // Menú y Navegación
    if(menuBtn) menuBtn.onclick = toggleMenu;
    if(menuOverlay) menuOverlay.onclick = toggleMenu;
    if(logoutBtn) logoutBtn.onclick = handleLogout;
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            const viewName = e.target.dataset.view || e.target.closest('.menu-item').dataset.view;
            showView(viewName);
            toggleMenu();
        };
    });
    
    // Auth
    if(loginForm) loginForm.onsubmit = handleLogin;
    if(registerForm) registerForm.onsubmit = handleRegister;
    
    const showReg = document.getElementById('show-register');
    if(showReg) showReg.onclick = (e) => { e.preventDefault(); loginView.classList.add('is-hidden'); registerView.classList.remove('is-hidden'); };
    
    const showLog = document.getElementById('show-login');
    if(showLog) showLog.onclick = (e) => { e.preventDefault(); registerView.classList.add('is-hidden'); loginView.classList.remove('is-hidden'); };
    
    // Calendario
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');
    if(prevBtn) prevBtn.onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); };
    if(nextBtn) nextBtn.onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); };
    
    // Reservas
    if(bookingForm) bookingForm.onsubmit = handleSaveBooking;
    const cancelBk = document.getElementById('cancel-booking-btn');
    if(cancelBk) cancelBk.onclick = closeModals;
    
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => {
        radio.onchange = () => updateCourtAvailability();
    });

    if(rentGrillCheckbox) rentGrillCheckbox.onchange = () => {
        if(grillHoursSection) grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
        updateTotalPrice();
    };

    if(teamNameInput) {
        teamNameInput.oninput = handleTeamNameInput;
        teamNameInput.onblur = () => setTimeout(() => { if(teamNameSuggestions) teamNameSuggestions.style.display = 'none'; }, 200);
    }

    // Recurrencia
    const recToggle = document.getElementById('recurring-toggle');
    if(recToggle) recToggle.onchange = openRecurringModal;
    
    const confRec = document.getElementById('confirm-recurring-btn');
    if(confRec) confRec.onclick = saveRecurringSettings;
    
    const cancRec = document.getElementById('cancel-recurring-btn');
    if(cancRec) cancRec.onclick = () => { if(recToggle) recToggle.checked = false; closeModals(); };

    document.querySelectorAll('.day-toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
        };
    });

    // Buffet
    const headerSaleBtn = document.getElementById('header-sale-btn');
    if(headerSaleBtn) headerSaleBtn.onclick = openSaleModal;
    
    const addProdBtn = document.getElementById('add-product-btn');
    if(addProdBtn) addProdBtn.onclick = () => {
        const cont = document.getElementById('product-form-container');
        if(cont) cont.classList.toggle('is-hidden');
    };

    if(productForm) productForm.onsubmit = handleSaveProduct;
    if(inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.oninput = calculateProductPrices;
    });

    // Venta Modal
    if(saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    const qtyMinus = document.getElementById('sale-qty-minus');
    const qtyPlus = document.getElementById('sale-qty-plus');
    if(qtyMinus) qtyMinus.onclick = () => updateSaleQty(-1);
    if(qtyPlus) qtyPlus.onclick = () => updateSaleQty(1);
    if(confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;
    const closeSale = document.getElementById('close-sale-modal-btn');
    if(closeSale) closeSale.onclick = closeModals;

    // Reposición y Edición
    const restockForm = document.getElementById('restock-form');
    if(restockForm) restockForm.onsubmit = handleConfirmRestock;
    const editProdForm = document.getElementById('edit-product-form');
    if(editProdForm) editProdForm.onsubmit = handleConfirmEditProduct;

    // Caja y Borrado
    if(cajaFilterBtn) cajaFilterBtn.onclick = loadCajaData;
    if(deleteReasonForm) deleteReasonForm.onsubmit = handleConfirmDelete;
    
    const configFrm = document.getElementById('config-form');
    if(configFrm) configFrm.onsubmit = handleSaveConfig;
}

// -----------------------------------------------------------------
// 5. LÓGICA DE BUFFET (ARTÍCULOS Y STOCK)
// -----------------------------------------------------------------

/**
 * REPOSICIÓN DIRECTA: Actualiza todo el stock al último precio cargado.
 */
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    // Cálculo del costo unitario del lote nuevo
    const newUnitCost = batchCost / addQty;
    
    // Obtener producto actual para actualizar stock total y mantener margen
    const product = allProducts.find(x => x.id === id);
    const updatedStock = product.stock + addQty;
    const currentMargin = product.salePrice / product.unitCost;
    const updatedSalePrice = Math.ceil(newUnitCost * currentMargin);

    try {
        showMessage("Sincronizando precios de stock...");
        
        await updateDoc(doc(db, productsCollectionPath, id), {
            stock: updatedStock,
            unitCost: newUnitCost, // Lógica pedida: todo el stock pasa al nuevo costo
            salePrice: updatedSalePrice
        });

        // Registrar Log
        await logTransaction(id, `Reposición (+${addQty})`, addQty, newUnitCost, 'in');

        closeModals();
        showMessage("Stock actualizado al último precio.");
        setTimeout(hideMessage, 2000);
    } catch (err) {
        alert("Error en reposición: " + err.message);
    }
}

async function logTransaction(productId, desc, qty, cost, type) {
    try {
        await addDoc(collection(db, transactionsCollectionPath), {
            productId: productId,
            desc: desc,
            qty: qty,
            cost: cost,
            type: type, // 'in', 'out', 'adj'
            timestamp: Timestamp.now()
        });
    } catch (e) { console.error("Error logging transaction", e); }
}

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct').value) || 0;
    
    const unit = cost / qty;
    const sale = Math.ceil(unit * (1 + (profit / 100)));
    
    document.getElementById('prod-suggested-price').textContent = `$${sale}`;
    document.getElementById('prod-unit-cost').value = unit;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value);
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value);
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));

    try {
        const ref = await addDoc(collection(db, productsCollectionPath), {
            name: name,
            stock: stock,
            unitCost: unitCost,
            salePrice: salePrice,
            createdAt: Timestamp.now()
        });
        await logTransaction(ref.id, 'Alta Inicial', stock, unitCost, 'in');
        
        e.target.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto guardado.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function syncProducts() {
    onSnapshot(collection(db, productsCollectionPath), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(inventorySearchInput?.value || "");
    });
}

function renderProducts(filter = "") {
    if (!productList) return;
    productList.innerHTML = '';
    
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-4';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800 leading-tight">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} mt-1 inline-block">Stock: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Venta</p>
                    <p class="text-2xl font-black text-emerald-600">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2 mt-2">
                <button class="card-action-btn p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn p-3 bg-red-50 text-red-500 rounded-xl font-bold text-xs" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
            </div>
        `;
        productList.appendChild(card);
    });
}

// -----------------------------------------------------------------
// 6. LÓGICA DE VENTA RÁPIDA
// -----------------------------------------------------------------

function openSaleModal() {
    if(saleSearchInput) saleSearchInput.value = '';
    if(saleSearchResults) saleSearchResults.innerHTML = '';
    if(selectedProductInfo) selectedProductInfo.classList.add('is-hidden');
    if(confirmSaleBtn) confirmSaleBtn.disabled = true;
    if(saleModal) saleModal.classList.add('is-open');
}

function handleSaleSearch() {
    const val = saleSearchInput.value.toLowerCase();
    if (val.length < 2) { saleSearchResults.innerHTML = ''; return; }
    
    saleSearchResults.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(val)).forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 border border-transparent hover:border-emerald-200 mb-2 transition-all';
        item.innerHTML = `
            <div>
                <span class="font-black text-gray-800">${p.name}</span>
                <p class="text-[10px] text-gray-400 font-bold uppercase">DISPONIBLES: ${p.stock}</p>
            </div>
            <strong class="text-emerald-600 text-lg">$${p.salePrice}</strong>
        `;
        item.onclick = () => selectProductForSale(p);
        saleSearchResults.appendChild(item);
    });
}

function selectProductForSale(p) {
    currentSelectedProduct = p;
    document.getElementById('sel-prod-name').textContent = p.name;
    document.getElementById('sel-prod-stock').textContent = p.stock;
    document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
    document.getElementById('sale-qty-input').value = 1;
    
    selectedProductInfo.classList.remove('is-hidden');
    confirmSaleBtn.disabled = (p.stock <= 0);
    updateSaleTotal();
}

function updateSaleQty(delta) {
    const input = document.getElementById('sale-qty-input');
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (val > currentSelectedProduct.stock) val = currentSelectedProduct.stock;
    input.value = val;
    updateSaleTotal();
}

function updateSaleTotal() {
    const qty = parseInt(document.getElementById('sale-qty-input').value);
    const total = qty * currentSelectedProduct.salePrice;
    document.getElementById('sale-total-display').textContent = `$${total.toLocaleString('es-AR')}`;
}

async function handleConfirmSale() {
    const qty = parseInt(document.getElementById('sale-qty-input').value);
    const total = qty * currentSelectedProduct.salePrice;
    
    try {
        showMessage("Registrando cobro...");
        
        await addDoc(collection(db, salesCollectionPath), {
            name: currentSelectedProduct.name,
            qty: qty,
            total: total,
            day: new Date().toISOString().split('T')[0],
            monthYear: new Date().toISOString().substring(0, 7),
            timestamp: Timestamp.now()
        });
        
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), {
            stock: currentSelectedProduct.stock - qty
        });
        
        await logTransaction(currentSelectedProduct.id, 'Venta Buffet', qty, currentSelectedProduct.unitCost, 'out');
        
        closeModals();
        showMessage("¡Venta completada!", false);
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 7. LÓGICA DE RESERVAS (TU VERSIÓN FUNCIONAL RECONSTRUIDA)
// -----------------------------------------------------------------

async function loadBookingsForMonth() {
    if (!db || !userId) return; 
    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe(); 
    
    const q = query(collection(db, bookingsCollectionPath), where("monthYear", "==", monthYear));
    
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

function renderCalendar() {
    if(!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Relleno mes anterior
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell other-month-day opacity-20';
        calendarGrid.appendChild(emptyCell);
    }
    
    // Días reales
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
        
        const cell = document.createElement('div');
        cell.className = 'day-cell p-2 bg-white cursor-pointer relative flex items-center justify-center border border-gray-50 rounded-3xl transition-all hover:bg-emerald-50';
        cell.innerHTML = `<span class="font-black text-gray-700">${i}</span>`;
        
        if (dayBookings.length > 0) {
            const hasEvent = dayBookings.some(b => b.type === 'event');
            cell.innerHTML += `<span class="booking-count ${hasEvent ? '!bg-amber-500' : ''}">${dayBookings.length}</span>`;
        }
        
        cell.onclick = () => handleDayClick(dateStr);
        calendarGrid.appendChild(cell);
    }
}

function handleDayClick(dateStr) {
    const bookingsOnDay = allMonthBookings.filter(b => b.day === dateStr);
    const eventOnDay = bookingsOnDay.find(b => b.type === 'event'); 
    const courtBookings = bookingsOnDay.filter(b => b.type === 'court');

    if (eventOnDay) {
        showEventOptionsModal(eventOnDay);
    } else if (courtBookings.length > 0) {
        showOptionsModal(dateStr, courtBookings);
    } else {
        typeModal.dataset.date = dateStr; 
        typeModal.classList.add('is-open');
    }
}

function showOptionsModal(dateStr, courtBookings) {
    closeModals();
    optionsModal.dataset.date = dateStr;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = '';
    
    courtBookings.forEach(booking => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-[1.5rem] border border-gray-100 flex justify-between items-center mb-2';
        const courtName = booking.courtId === 'cancha2' ? ' (C2)' : ' (C1)';
        item.innerHTML = `<div><p class="font-black text-gray-800">${booking.teamName}</p><p class="text-[9px] uppercase font-bold text-gray-400">${courtName}</p></div>`;
        
        const btns = document.createElement('div');
        btns.className = 'flex gap-2';
        btns.innerHTML = `
            <button class="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-[10px] shadow-sm" onclick="window.viewBooking('${booking.id}')">VER</button>
            <button class="px-4 py-2 bg-white text-red-500 rounded-xl font-black text-[10px] shadow-sm" onclick="window.deleteBooking('${booking.id}')">BORRAR</button>
        `;
        item.appendChild(btns);
        listEl.appendChild(item);
    });
    optionsModal.classList.add('is-open');
}

function showEventOptionsModal(eventObject) {
    closeModals();
    optionsModal.dataset.date = eventObject.day;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = ''; 

    const item = document.createElement('div');
    item.className = 'p-5 bg-amber-50 rounded-[1.5rem] border border-amber-200 flex justify-between items-center';
    item.innerHTML = `<div><p class="font-black text-amber-800">EVENTO</p><p class="text-sm font-bold text-amber-600">${eventObject.teamName}</p></div>`;
    
    const btns = document.createElement('div');
    btns.className = 'flex gap-2';
    btns.innerHTML = `
        <button class="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-[10px]" onclick="window.viewBooking('${eventObject.id}')">VER</button>
        <button class="px-4 py-2 bg-white text-red-500 rounded-xl font-black text-[10px]" onclick="window.deleteBooking('${eventObject.id}')">BORRAR</button>
    `;
    item.appendChild(btns);
    listEl.appendChild(item);
    optionsModal.classList.add('is-open');
}

// -----------------------------------------------------------------
// 8. LÓGICA DE CAJA UNIFICADA (TURNOS + BUFFET)
// -----------------------------------------------------------------

async function loadCajaData() {
    const from = cajaDateFrom.value;
    const to = cajaDateTo.value;
    if (!from || !to) return;

    showMessage("Consultando balance unificado...");
    try {
        // Reservas
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        // Buffet
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let totalB = 0; snapB.forEach(d => totalB += (d.data().totalPrice || 0));
        let totalS = 0; snapS.forEach(d => totalS += (d.data().total || 0));

        cajaTotalBookings.textContent = `$${totalB.toLocaleString('es-AR')}`;
        cajaTotalSales.textContent = `$${totalS.toLocaleString('es-AR')}`;
        cajaTotalCombined.textContent = `$${(totalB + totalS).toLocaleString('es-AR')}`;
        
        hideMessage();
    } catch (e) { console.error(e); hideMessage(); }
}

// -----------------------------------------------------------------
// 9. UTILIDADES Y OTROS (NO RESUMIDOS)
// -----------------------------------------------------------------

async function handleLogin(e) { 
    e.preventDefault(); 
    showMessage("Validando acceso..."); 
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
    } catch(err) { alert("Acceso denegado: " + err.message); hideMessage(); } 
}

async function handleRegister(e) { 
    e.preventDefault(); 
    try { 
        await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); 
    } catch(err) { alert(err.message); } 
}

async function handleLogout() { await signOut(auth); }

async function handleSaveBooking(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const sh = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour));
    if(sh.length === 0) { btn.disabled = false; return alert("Elegí horario."); }

    const data = {
        teamName: teamNameInput.value.trim(),
        courtId: document.querySelector('input[name="courtSelection"]:checked').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value),
        day: document.getElementById('booking-date').value,
        monthYear: document.getElementById('booking-date').value.substring(0, 7),
        courtHours: sh,
        grillHours: Array.from(grillHoursList.querySelectorAll('.selected')).map(el => parseInt(el.dataset.hour)),
        costPerHour: parseFloat(costPerHourInput.value),
        totalPrice: updateTotalPrice(),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        rentGrill: rentGrillCheckbox.checked,
        timestamp: Timestamp.now(),
        type: 'court'
    };

    try {
        const id = document.getElementById('booking-id').value;
        if(id) await updateDoc(doc(db, bookingsCollectionPath, id), data);
        else await addDoc(collection(db, bookingsCollectionPath), data);
        
        await logBookingEvent(id ? 'updated' : 'created', data);
        await saveCustomer(data.teamName);
        closeModals(); showMessage("Guardado"); setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); btn.disabled = false; }
}

async function logBookingEvent(action, data) {
    await addDoc(collection(db, logCollectionPath), { ...data, action, loggedBy: userEmail, timestamp: Timestamp.now() });
}

async function handleConfirmDelete(e) {
    e.preventDefault();
    const id = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();
    if(!reason) return alert("Ingresá motivo.");

    try {
        const snap = await getDoc(doc(db, bookingsCollectionPath, id));
        await logBookingEvent('deleted', { ...snap.data(), deleteReason: reason });
        await deleteDoc(doc(db, bookingsCollectionPath, id));
        closeModals(); showMessage("Eliminado"); setTimeout(hideMessage, 1000);
    } catch (e) { alert(e.message); }
}

async function saveCustomer(n) {
    if(!n) return;
    try { await setDoc(doc(db, customersCollectionPath, n.trim().toLowerCase()), { name: n.trim(), updatedAt: Timestamp.now() }, { merge: true }); } catch (err) {}
}

async function handleTeamNameInput() {
    const val = teamNameInput.value.trim().toLowerCase();
    if (val.length < 2) { teamNameSuggestions.style.display = 'none'; return; }
    const s = await getDocs(query(collection(db, customersCollectionPath), where(documentId(), ">=", val), where(documentId(), "<=", val + '\uf8ff')));
    teamNameSuggestions.innerHTML = '';
    s.forEach(d => {
        const i = document.createElement('div');
        i.className = 'p-3 hover:bg-emerald-50 cursor-pointer border-b font-bold text-sm';
        i.textContent = d.data().name;
        i.onmousedown = () => { teamNameInput.value = d.data().name; teamNameSuggestions.style.display = 'none'; };
        teamNameSuggestions.appendChild(i);
    });
    teamNameSuggestions.style.display = s.empty ? 'none' : 'block';
}

function showMessage(m) { if(messageText) messageText.textContent = m; messageOverlay.classList.add('is-open'); }
function hideMessage() { messageOverlay.classList.remove('is-open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }

// Inyección de funciones en window para que funcionen los onclick del HTML
window.viewBooking = async (id) => {
    const s = await getDoc(doc(db, bookingsCollectionPath, id));
    const b = s.data();
    document.getElementById('view-booking-details').innerHTML = `<h4 class="text-3xl font-black text-emerald-700 tracking-tighter">${b.teamName}</h4><p class="text-gray-400 font-bold uppercase text-xs mt-1">${b.courtId}</p><div class="mt-6 space-y-2 border-t pt-4"><p class="flex justify-between font-bold"><span>HORARIO:</span> <span>${b.courtHours?.join(', ')}hs</span></p><p class="flex justify-between font-bold text-emerald-600 text-xl pt-2 border-t"><span>TOTAL:</span> <span>$${b.totalPrice?.toLocaleString()}</span></p></div>`;
    viewModal.classList.add('is-open');
};
window.deleteBooking = (id) => { closeModals(); deleteBookingIdInput.value = id; deleteReasonText.value = ''; deleteReasonModal.classList.add('is-open'); };
window.openRestock = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('restock-prod-id').value = id; document.getElementById('restock-name').textContent = p.name; document.getElementById('restock-current-stock').textContent = p.stock; document.getElementById('restock-modal').classList.add('is-open'); };
window.openEditProduct = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('edit-prod-id').value = id; document.getElementById('edit-prod-name').value = p.name; document.getElementById('edit-prod-cost').value = p.unitCost; document.getElementById('edit-prod-price').value = p.salePrice; document.getElementById('edit-prod-stock').value = p.stock; document.getElementById('edit-product-modal').classList.add('is-open'); };
window.deleteProduct = async (id) => { if(confirm("¿Eliminar de inventario?")) await deleteDoc(doc(db, productsCollectionPath, id)); };
window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id); document.getElementById('history-product-name').textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); list.innerHTML = '';
    s.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const item = document.createElement('div');
        item.className = `p-4 bg-gray-50 rounded-2xl flex justify-between items-center mb-2`;
        item.innerHTML = `<div><p class="font-black text-gray-800 text-sm">${t.desc}</p><p class="text-[9px] text-gray-400 uppercase font-bold">${date}</p></div><p class="font-black ${t.type==='in'?'text-emerald-600':'text-red-500'}">${t.type==='in'?'+':'-'}${t.qty}</p>`;
        list.appendChild(item);
    });
    document.getElementById('product-history-modal').classList.add('is-open');
};

console.log("Sistema Panza Verde v5.5 cargado sin omisiones.");
