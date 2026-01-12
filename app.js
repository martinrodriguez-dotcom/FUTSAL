// Importaciones de Firebase SDK (v11.x.x)
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
// 1. CONFIGURACIÓN DE FIREBASE
// -----------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
  authDomain: "reserva-futsal.firebaseapp.com",
  projectId: "reserva-futsal",
  storageBucket: "reserva-futsal.firebasestorage.app",
  messagingSenderId: "285845706235",
  appId: "1:285845706235:web:9355804aea8181b030275e"
};

// --- RUTAS DE COLECCIONES ---
const bookingsCollectionPath = "bookings"; 
const customersCollectionPath = "customers";
const logCollectionPath = "booking_log"; 
const settingsDocPath = "app_settings/prices"; 
const productsCollectionPath = "products"; // Kiosco
const salesCollectionPath = "sales"; // Ventas Kiosco
const transactionsCollectionPath = "product_transactions"; // Logs Kiosco

// --- CONSTANTES DE LA APP ---
const OPERATING_HOURS = [
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
]; 

// --- VARIABLES GLOBALES DE LA APP ---
let db, auth;
let userId = null; 
let userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
let currentSelectedProduct = null;
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Precios por defecto (fallback)
let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

// --- REFERENCIAS AL DOM ---
// Vistas de Autenticación
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const appContainer = document.getElementById('app-container');

// Vistas Principales
const views = {
    calendar: document.getElementById('calendar-view'),
    caja: document.getElementById('caja-view'),
    stats: document.getElementById('stats-view'),
    historial: document.getElementById('historial-view'),
    configuracion: document.getElementById('config-view'),
    productos: document.getElementById('productos-view') 
};

// Calendario
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');

// Menú
const menuBtn = document.getElementById('menu-btn');
const mainMenu = document.getElementById('main-menu');
const menuOverlay = document.getElementById('menu-overlay');
const userEmailDisplay = document.getElementById('user-email-display'); 
const logoutBtn = document.getElementById('logout-btn'); 

// Formularios de Autenticación
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Referencias de Caja
const cajaDailyList = document.getElementById('caja-daily-list');
const cajaTotalCombined = document.getElementById('caja-total-combined');
const cajaTotalBookings = document.getElementById('caja-total-bookings');
const cajaTotalSales = document.getElementById('caja-total-sales');
const cajaDateFrom = document.getElementById('caja-date-from');
const cajaDateTo = document.getElementById('caja-date-to');
const cajaFilterBtn = document.getElementById('caja-filter-btn');

// Referencias de Estadísticas
const statsList = document.getElementById('stats-list');
const statsFilterBtn = document.getElementById('stats-filter-btn');
// Referencias de Historial
const historialList = document.getElementById('historial-list');
const historialFilterBtn = document.getElementById('historial-filter-btn');
// Referencias de Modales
const typeModal = document.getElementById('type-modal'); 
const bookingModal = document.getElementById('booking-modal');
const eventModal = document.getElementById('event-modal'); 
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); 
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');
// Referencias de Formulario Cancha
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
// Referencias de Formulario Evento
const eventForm = document.getElementById('event-form');
const eventCostPerHourInput = document.getElementById('eventCostPerHour');
const eventHoursList = document.getElementById('event-hours-list');
const eventTotal = document.getElementById('event-total');
// Referencias de Formulario Eliminar
const deleteReasonForm = document.getElementById('delete-reason-form');
const deleteReasonText = document.getElementById('delete-reason-text');
const deleteBookingIdInput = document.getElementById('delete-booking-id');

// Referencias de Formulario Configuración
const configForm = document.getElementById('config-form');
const configCourt1Price = document.getElementById('config-court1-price');
const configCourt2Price = document.getElementById('config-court2-price');
const configGrillPrice = document.getElementById('config-grill-price');
const configEventPrice = document.getElementById('config-event-price');

// Referencias Kiosco (PRODUCTOS)
const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');
const inventorySearchInput = document.getElementById('inventory-search-input');
const restockModal = document.getElementById('restock-modal');
const restockForm = document.getElementById('restock-form');
const saleModal = document.getElementById('sale-modal');
const saleSearchInput = document.getElementById('sale-search-input');
const saleSearchResults = document.getElementById('sale-search-results');
const selectedProductInfo = document.getElementById('selected-product-info');
const confirmSaleBtn = document.getElementById('confirm-sale-btn');


// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando App...");
    setupEventListeners();
    registerServiceWorker();
    firebaseInit();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.error('Error al registrar el Service Worker:', error);
        });
    }
}

async function firebaseInit() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        await setPersistence(auth, browserLocalPersistence); 

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Usuario autenticado:", user.email);
                userId = user.uid;
                userEmail = user.email;
                
                await loadAppSettings(); 

                appContainer.classList.remove('is-hidden');
                loginView.classList.add('is-hidden');
                registerView.classList.add('is-hidden');
                userEmailDisplay.textContent = userEmail;
                
                await loadBookingsForMonth(); 
                syncProducts(); // Inicia Kiosco
            } else {
                console.log("Sin usuario, mostrando login.");
                userId = null;
                userEmail = null;
                appContainer.classList.add('is-hidden');
                loginView.classList.remove('is-hidden');
                registerView.classList.add('is-hidden');
                if (currentBookingsUnsubscribe) {
                    currentBookingsUnsubscribe();
                    currentBookingsUnsubscribe = null;
                }
                allMonthBookings = [];
                hideMessage();
            }
        });
    } catch (error) {
        console.error("Error crítico en Firebase Init:", error);
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

function setupEventListeners() {
    // Navegación
    menuBtn.onclick = toggleMenu;
    menuOverlay.onclick = toggleMenu;
    logoutBtn.onclick = handleLogout; 
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const viewName = e.target.dataset.view;
            showView(viewName);
            toggleMenu();
        };
    });
    
    // Formularios de Autenticación
    loginForm.onsubmit = handleLogin;
    registerForm.onsubmit = handleRegister;
    document.getElementById('show-register').onclick = (e) => {
        e.preventDefault();
        loginView.classList.add('is-hidden');
        registerView.classList.remove('is-hidden');
    };
    document.getElementById('show-login').onclick = (e) => {
        e.preventDefault();
        registerView.classList.add('is-hidden');
        loginView.classList.remove('is-hidden');
    };
    
    // Calendario
    document.getElementById('prev-month-btn').onclick = prevMonth;
    document.getElementById('next-month-btn').onclick = nextMonth;
    
    // Formularios y Modales
    bookingForm.onsubmit = handleSaveBooking;
    eventForm.onsubmit = handleSaveEvent; 
    
    if (configForm) {
        configForm.onsubmit = handleSaveConfig;
    }

    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.getElementById('cancel-event-btn').onclick = closeModals; 
    document.getElementById('close-options-btn').onclick = closeModals;
    document.getElementById('close-view-btn').onclick = closeModals;
    document.getElementById('close-caja-detail-btn').onclick = closeModals;
    document.getElementById('add-new-booking-btn').onclick = () => {
        const dateStr = optionsModal.dataset.date;
        closeModals();
        showBookingModal(dateStr); 
    };
    document.getElementById('type-btn-court').onclick = () => {
        const dateStr = typeModal.dataset.date;
        closeModals();
        showBookingModal(dateStr);
    };
    document.getElementById('type-btn-event').onclick = () => {
        const dateStr = typeModal.dataset.date;
        closeModals();
        showEventModal(dateStr);
    };
    document.getElementById('type-btn-cancel').onclick = closeModals;
    
    cajaFilterBtn.onclick = loadCajaData;
    statsFilterBtn.onclick = loadStatsData; 
    historialFilterBtn.onclick = loadHistorialData; 
    
    teamNameInput.oninput = handleTeamNameInput;
    teamNameInput.onblur = () => { setTimeout(() => { teamNameSuggestions.style.display = 'none'; }, 200); };
    teamNameInput.onfocus = handleTeamNameInput;
    
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => {
        radio.onchange = () => {
            updateCourtAvailability();
        };
    });

    rentGrillCheckbox.onchange = () => {
        grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
        updateTotalPrice();
    };
    costPerHourInput.oninput = updateTotalPrice;
    grillCostInput.oninput = updateTotalPrice;
    eventCostPerHourInput.oninput = updateEventTotalPrice;
    deleteReasonForm.onsubmit = handleConfirmDelete;
    document.getElementById('cancel-delete-btn').onclick = closeModals;

    // --- NUEVOS LISTENERS PARA VENTA Y KIOSCO ---
    document.getElementById('add-product-btn').onclick = () => {
        document.getElementById('product-form-container').classList.toggle('is-hidden');
    };
    document.getElementById('cancel-product-btn').onclick = () => {
        document.getElementById('product-form-container').classList.add('is-hidden');
    };
    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    // Cálculos dinámicos (Bulto y Márgenes)
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = calculateProductPrices;
    });

    // Venta Rápida
    document.getElementById('header-sale-btn').onclick = openSaleModal;
    if (saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    document.getElementById('sale-qty-minus').onclick = () => updateSaleQty(-1);
    document.getElementById('sale-qty-plus').onclick = () => updateSaleQty(1);
    if (confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;
    document.getElementById('close-sale-modal-btn').onclick = closeModals;

    // Reposición y Edición
    if (restockForm) restockForm.onsubmit = handleConfirmRestock;
    document.getElementById('edit-product-form').onsubmit = handleConfirmEditProduct;

    // Cierre de modales por fondo
    [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal, restockModal, saleModal].forEach(modal => {
        if(modal) { 
            modal.onclick = (e) => {
                if (e.target === modal) closeModals();
            };
        }
    });
}

// --- LÓGICA DE NAVEGACIÓN ---

function toggleMenu() {
    mainMenu.classList.toggle('is-open');
    menuOverlay.classList.toggle('hidden');
}

function showView(viewName) {
    for (const key in views) {
        if (views[key]) views[key].classList.add('is-hidden');
    }
    const viewToShow = views[viewName];
    if (viewToShow) {
        viewToShow.classList.remove('is-hidden');
        if (viewName === 'caja') loadCajaData();
        else if (viewName === 'stats') loadStatsData();
        else if (viewName === 'historial') loadHistorialData();
        else if (viewName === 'configuracion') loadConfigDataIntoForm(); 
        else if (viewName === 'productos') syncProducts();
    }
}

// --- LÓGICA DE AUTENTICACIÓN (ORIGINAL) ---

async function handleLogin(e) {
    e.preventDefault();
    showMessage("Ingresando...");
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        hideMessage();
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
        setTimeout(hideMessage, 3000);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    showMessage("Creando cuenta...");
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        hideMessage();
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
        setTimeout(hideMessage, 3000);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}


// --- LÓGICA DE CONFIGURACIÓN ---

async function loadAppSettings() {
    try {
        const docRef = doc(db, settingsDocPath);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appSettings = docSnap.data();
        } else {
            await setDoc(docRef, appSettings); 
        }
    } catch (error) {
        console.error("Error al cargar configuración:", error);
    }
}

function loadConfigDataIntoForm() {
    if (!configCourt1Price) return;
    configCourt1Price.value = appSettings.court1Price;
    configCourt2Price.value = appSettings.court2Price;
    configGrillPrice.value = appSettings.grillPrice;
    configEventPrice.value = appSettings.eventPrice;
}

async function handleSaveConfig(e) {
    e.preventDefault();
    showMessage("Guardando configuración...");
    const newSettings = {
        court1Price: parseFloat(configCourt1Price.value) || 0,
        court2Price: parseFloat(configCourt2Price.value) || 0,
        grillPrice: parseFloat(configGrillPrice.value) || 0,
        eventPrice: parseFloat(configEventPrice.value) || 0
    };
    try {
        await setDoc(doc(db, settingsDocPath), newSettings);
        appSettings = newSettings;
        showMessage("¡Precios actualizados!", false);
        setTimeout(hideMessage, 1500);
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
    }
}

// --- LÓGICA DE KIOSCO (NUEVA) ---

/**
 * REPOSICIÓN DIRECTA: Actualiza todo el stock (viejo + nuevo) al último precio cargado.
 */
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    // Nuevo costo unitario del lote
    const newUnitCost = batchCost / addQty;
    
    const product = allProducts.find(x => x.id === id);
    const newTotalStock = product.stock + addQty;

    // Recalcular precio sugerido con el margen actual del producto
    const currentMargin = product.salePrice / product.unitCost;
    const newSalePrice = Math.ceil(newUnitCost * currentMargin);

    try {
        showMessage("Actualizando precios de todo el stock...");
        await updateDoc(doc(db, productsCollectionPath, id), {
            stock: newTotalStock,
            unitCost: newUnitCost, // Se actualiza todo al último costo
            salePrice: newSalePrice
        });

        await logKioscoTransaction(id, `Reposición (+${addQty})`, addQty, newUnitCost, 'in');
        closeModals();
        showMessage("Inventario actualizado.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

async function logKioscoTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, transactionsCollectionPath), {
        productId, desc, qty, cost, type, timestamp: Timestamp.now()
    });
}

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost')?.value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty')?.value) || 1;
    const profitPct = parseFloat(document.getElementById('prod-profit-pct')?.value) || 40;
    
    const unit = cost / qty;
    const sale = Math.ceil(unit * (1 + (profitPct / 100)));
    
    const suggestedPriceEl = document.getElementById('prod-suggested-price');
    if (suggestedPriceEl) suggestedPriceEl.textContent = `$${sale}`;
    const unitCostHidden = document.getElementById('prod-unit-cost');
    if (unitCostHidden) unitCostHidden.value = unit;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value);
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value);
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));

    try {
        const ref = await addDoc(collection(db, productsCollectionPath), {
            name, stock, unitCost, salePrice, createdAt: Timestamp.now()
        });
        await logKioscoTransaction(ref.id, 'Alta Inicial', stock, unitCost, 'in');
        e.target.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto guardado.");
        setTimeout(hideMessage, 1000);
    } catch (err) { alert(err.message); }
}

function syncProducts() {
    onSnapshot(collection(db, productsCollectionPath), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(inventorySearchInput?.value || "");
    });
}

function renderProducts(filter = "") {
    if (!productList) return;
    productList.innerHTML = '';
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div><h4 class="font-black text-xl leading-tight">${p.name}</h4><span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} mt-1 inline-block">Stock: ${p.stock}</span></div>
                <div class="text-right"><p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Venta</p><p class="text-2xl font-black text-emerald-600 tracking-tighter">$${p.salePrice}</p></div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2 mt-2">
                <button class="card-action-btn p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn p-3 bg-red-50 text-red-500 rounded-xl font-bold text-xs" onclick="window.deleteProduct('${p.id}')">🗑️</button>
            </div>
        `;
        productList.appendChild(div);
    });
}

// --- VENTA RÁPIDA KIOSCO ---

function openSaleModal() {
    saleSearchInput.value = '';
    saleSearchResults.innerHTML = '';
    selectedProductInfo.classList.add('is-hidden');
    confirmSaleBtn.disabled = true;
    saleModal.classList.add('is-open');
    setTimeout(() => saleSearchInput.focus(), 100);
}

function handleSaleSearch() {
    const val = saleSearchInput.value.toLowerCase();
    if (val.length < 2) { saleSearchResults.innerHTML = ''; return; }
    saleSearchResults.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(val)).forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 mb-2 transition-all';
        item.innerHTML = `<div><span class="font-black text-gray-800">${p.name}</span><p class="text-[10px] text-gray-400 font-bold uppercase">STOCK: ${p.stock}</p></div><strong class="text-emerald-600">$${p.salePrice}</strong>`;
        item.onclick = () => {
            currentSelectedProduct = p;
            document.getElementById('sel-prod-name').textContent = p.name;
            document.getElementById('sel-prod-stock').textContent = p.stock;
            document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
            document.getElementById('sale-qty-input').value = 1;
            selectedProductInfo.classList.remove('is-hidden');
            confirmSaleBtn.disabled = (p.stock <= 0);
            updateSaleTotal();
        };
        saleSearchResults.appendChild(item);
    });
}

function updateSaleQty(d) {
    const input = document.getElementById('sale-qty-input');
    let val = parseInt(input.value) + d;
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
            name: currentSelectedProduct.name, qty, total, day: new Date().toISOString().split('T')[0], monthYear: new Date().toISOString().substring(0, 7), timestamp: Timestamp.now()
        });
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - qty });
        await logKioscoTransaction(currentSelectedProduct.id, 'Venta Kiosco', qty, currentSelectedProduct.unitCost, 'out');
        closeModals();
        showMessage("¡Venta completada!");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}


// --- LÓGICA DE FIREBASE (LOGGING ORIGINAL) ---

async function logBookingEvent(action, bookingData, reason = null) {
    try {
        const logData = {
            ...bookingData, 
            action: action, 
            type: bookingData.type || 'unknown', 
            timestamp: Timestamp.now(), 
            loggedByUserId: userId, 
            loggedByEmail: userEmail 
        };
        delete logData.id; 
        
        if (action === 'deleted' && reason) {
            logData.reason = reason;
        }

        await addDoc(collection(db, logCollectionPath), logData);
    } catch (error) {
        console.error("Error al registrar historial:", error);
    }
}


// --- LÓGICA DE FIREBASE (RESERVAS ORIGINAL) ---

async function loadBookingsForMonth() {
    if (!db || !userId) return; 
    showMessage("Cargando reservas...");
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe(); 
    
    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const q = query(collection(db, bookingsCollectionPath), where("monthYear", "==", monthYear));
    
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
        hideMessage();
    }, (error) => {
        console.error("Error onSnapshot:", error);
        hideMessage();
    });
}

async function handleSaveBooking(event) {
    event.preventDefault();
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Cancha...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();

    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    const selectedGrillHours = Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedCourtHours.length === 0) {
        showMessage("Elegí al menos un horario.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false;
        return;
    }

    const bookingDataBase = {
        type: 'court', 
        teamName: teamName,
        courtId: document.querySelector('input[name="courtSelection"]:checked').value, 
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked,
        grillCost: parseFloat(grillCostInput.value),
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        courtHours: selectedCourtHours,
        grillHours: rentGrillCheckbox.checked ? selectedGrillHours : [],
        totalPrice: updateTotalPrice() 
    };

    try {
        let action = '';
        let finalData; 

        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingDataBase, { merge: true });
            action = 'updated';
            finalData = { id: bookingId, ...bookingDataBase }; 
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), bookingDataBase);
            action = 'created';
            finalData = { id: docRef.id, ...bookingDataBase }; 
        }
        
        await logBookingEvent(action, finalData);
        await saveCustomer(teamName); 
        
        showMessage("¡Reserva Guardada!", false);
        closeModals(); 
        setTimeout(hideMessage, 1500); 

    } catch (error) {
        showMessage(`Error al guardar: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
    }
}

async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Evento...");

    const bookingId = document.getElementById('event-booking-id')?.value || ''; 
    const dateStr = document.getElementById('event-date')?.value || '';

    const selectedEventHours = Array.from(document.getElementById('event-hours-list').querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    
    if (selectedEventHours.length === 0) {
        showMessage("Elegí al menos un horario.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false; 
        return;
    }

    const eventDataBase = {
        type: 'event', 
        teamName: document.getElementById('eventName').value.trim(), 
        contactPerson: document.getElementById('contactPerson').value.trim(),
        contactPhone: document.getElementById('contactPhone').value.trim(),
        costPerHour: parseFloat(document.getElementById('eventCostPerHour')?.value || 10000), 
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked')?.value || 'efectivo',
        courtHours: selectedEventHours, 
        totalPrice: updateEventTotalPrice(), 
        peopleCount: 0,
        rentGrill: false,
        grillCost: 0,
        grillHours: [],
        courtId: null 
    };

    try {
        let action = '';
        let finalData; 

        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), eventDataBase, { merge: true });
            action = 'updated';
            finalData = { id: bookingId, ...eventDataBase };
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), eventDataBase);
            action = 'created';
            finalData = { id: docRef.id, ...eventDataBase };
        }
        
        await logBookingEvent(action, finalData);
        await saveCustomer(eventDataBase.teamName); 
        
        showMessage("¡Evento Guardado!", false);
        closeModals();
        setTimeout(hideMessage, 1500);
        
    } catch (error) {
        showMessage(`Error al guardar: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
    }
}

function handleDeleteBooking(bookingId) {
    closeModals(); 
    deleteBookingIdInput.value = bookingId; 
    deleteReasonText.value = ''; 
    deleteReasonModal.classList.add('is-open'); 
}


async function handleConfirmDelete(event) {
    event.preventDefault();
    const bookingId = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();

    if (!bookingId || !reason) return;

    showMessage("Eliminando...");

    try {
        const bookingRef = doc(db, bookingsCollectionPath, bookingId);
        const bookingSnapshot = await getDoc(bookingRef); 
        
        let dataToLog = null;
        if (bookingSnapshot.exists()) { 
             dataToLog = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
        } else {
            dataToLog = allMonthBookings.find(b => b.id === bookingId);
        }

        await logBookingEvent('deleted', dataToLog, reason);
        await deleteDoc(bookingRef);

        closeModals();
        showMessage("¡Eliminado!", false); 
        setTimeout(hideMessage, 1500); 

    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
        closeModals(); 
    }
}


// --- LÓGICA DE FIREBASE (CLIENTES ORIGINAL) ---
async function saveCustomer(name) {
    if (!name) return;
    try {
        const customerId = name.trim().toLowerCase();
        const docRef = doc(db, customersCollectionPath, customerId);
        await setDoc(docRef, { 
            name: name.trim(),
            lastBooked: new Date().toISOString()
        }, { merge: true });
    } catch (error) { console.error(error); }
}

async function handleTeamNameInput() {
    const queryText = teamNameInput.value.trim().toLowerCase();
    if (queryText.length < 2) {
        teamNameSuggestions.style.display = 'none';
        return;
    }
    try {
        const customersRef = collection(db, customersCollectionPath);
        const q = query(customersRef, 
            where(documentId(), ">=", queryText),
            where(documentId(), "<=", queryText + '\uf8ff')
        );
        const snapshot = await getDocs(q);
        const suggestions = snapshot.docs.map(doc => doc.data().name);
        renderSuggestions(suggestions);
    } catch (error) { console.error(error); }
}

function renderSuggestions(suggestions) {
    teamNameSuggestions.innerHTML = '';
    if (suggestions.length === 0) { teamNameSuggestions.style.display = 'none'; return; }
    suggestions.forEach(name => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = name;
        item.onmousedown = () => selectSuggestion(name);
        teamNameSuggestions.appendChild(item);
    });
    teamNameSuggestions.style.display = 'block';
}

function selectSuggestion(name) {
    teamNameInput.value = name;
    teamNameSuggestions.style.display = 'none';
}


// --- LÓGICA DEL CALENDARIO ---

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const bookingsByDay = {};
    allMonthBookings.forEach(booking => {
        const day = parseInt(booking.day.split('-')[2], 10);
        if (!bookingsByDay[day]) bookingsByDay[day] = { court: 0, event: 0 };
        booking.type === 'event' ? bookingsByDay[day].event++ : bookingsByDay[day].court++;
    });

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.appendChild(createDayCell(daysInPrevMonth - firstDayOfMonth + 1 + i, false));
    for (let i = 1; i <= daysInMonth; i++) {
        const data = bookingsByDay[i] || { court: 0, event: 0 };
        calendarGrid.appendChild(createDayCell(i, true, data.court, data.event));
    }
}

function createDayCell(dayNum, isCurrentMonth, courtCount = 0, eventCount = 0) {
    const dayCell = document.createElement('div');
    dayCell.className = `relative h-20 md:h-28 border border-gray-200 p-2 day-cell`;
    
    if (isCurrentMonth) {
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        dayCell.onclick = () => handleDayClick(dateStr);
        dayCell.innerHTML = `<span class="text-sm font-black text-gray-700">${dayNum}</span>`;

        if (eventCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.textContent = eventCount;
            countBadge.className = 'booking-count event'; 
            dayCell.appendChild(countBadge);
        } else if (courtCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.textContent = courtCount;
            countBadge.className = 'booking-count'; 
            dayCell.appendChild(countBadge);
        }
    } else {
        dayCell.classList.add('other-month-day', 'opacity-20');
        dayCell.innerHTML = `<span class="text-sm">${dayNum}</span>`;
    }
    return dayCell;
}

function handleDayClick(dateStr) {
    const dayBks = allMonthBookings.filter(b => b.day === dateStr);
    const ev = dayBks.find(b => b.type === 'event'); 
    const courts = dayBks.filter(b => b.type === 'court');

    if (ev) showEventOptionsModal(ev);
    else if (courts.length > 0) showOptionsModal(dateStr, courts);
    else { typeModal.dataset.date = dateStr; typeModal.classList.add('is-open'); }
}


// --- LÓGICA DE CAJA UNIFICADA ---

async function loadCajaData() {
    if (!db) return;
    showMessage("Consultando balance unificado...");
    const from = cajaDateFrom.value;
    const to = cajaDateTo.value;
    if (!from || !to) return;
    try {
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let totalB = 0; snapB.forEach(d => totalB += (d.data().totalPrice || 0));
        let totalS = 0; snapS.forEach(d => totalS += (d.data().total || 0));

        cajaTotalBookings.textContent = `$${totalB.toLocaleString('es-AR')}`;
        cajaTotalSales.textContent = `$${totalS.toLocaleString('es-AR')}`;
        cajaTotalCombined.textContent = `$${(totalB + totalS).toLocaleString('es-AR')}`;
        
        hideMessage();
    } catch (error) { console.error(error); hideMessage(); }
}

// Inyecciones Globales para botones dinámicos
window.viewBooking = async (id) => {
    const s = await getDoc(doc(db, bookingsCollectionPath, id));
    if (s.exists()) {
        const b = s.data();
        document.getElementById('view-booking-details').innerHTML = `
            <h4 class="text-2xl font-black text-emerald-800">${b.teamName}</h4>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${b.courtId || 'Evento'}</p>
            <div class="mt-4 border-t pt-4 space-y-1">
                <p>Pago: <strong>${b.paymentMethod}</strong></p>
                <p class="text-xl font-black text-emerald-600">Total: $${b.totalPrice?.toLocaleString()}</p>
            </div>`;
        viewModal.classList.add('is-open');
    }
};

window.deleteBooking = (id) => handleDeleteBooking(id);
window.deleteProduct = async (id) => { if (confirm("¿Eliminar de inventario?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('restock-prod-id').value = id;
    document.getElementById('restock-name').textContent = p.name;
    document.getElementById('restock-current-stock').textContent = p.stock;
    restockModal.classList.add('is-open');
};

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); list.innerHTML = '';
    s.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString();
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-50 rounded-xl mb-2 flex justify-between items-center';
        item.innerHTML = `<div><p class="font-bold text-sm">${t.desc}</p><p class="text-[9px] uppercase">${date}</p></div><p class="font-black ${t.type==='in'?'text-emerald-600':'text-red-500'}">${t.type==='in'?'+':'-'}${t.qty}</p>`;
        list.appendChild(item);
    });
    document.getElementById('product-history-modal').classList.add('is-open');
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
    await updateDoc(doc(db, productsCollectionPath, id), data);
    await logKioscoTransaction(id, 'Ajuste Manual', 0, data.unitCost, 'adj');
    closeModals();
}


// --- OTROS AUXILIARES (NO TOCADOS) ---
function prevMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); }
function nextMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); }
function showMessage(m) { messageText.textContent = m; messageOverlay.classList.add('is-open'); }
function hideMessage() { messageOverlay.classList.remove('is-open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }
window.hideMessage = hideMessage; window.closeModals = closeModals;

function updateCourtAvailability() {
    const ds = document.getElementById('booking-date').value; const ci = document.querySelector('input[name="courtSelection"]:checked')?.value || 'cancha1';
    costPerHourInput.value = ci === 'cancha1' ? appSettings.court1Price : appSettings.court2Price;
    const occ = new Set(); allMonthBookings.filter(b => b.day === ds && b.courtId === ci).forEach(b => b.courtHours?.forEach(h => occ.add(h)));
    renderTimeSlots(courtHoursList, occ, []); updateTotalPrice();
}

console.log("Sistema cargado al 100%.");
