// Importaciones de Firebase SDK (v11.6.1)
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

// --- CONSTANTES ---
const COLLECTIONS = {
    BOOKINGS: "bookings",
    CUSTOMERS: "customers",
    LOGS: "booking_log",
    SETTINGS: "app_settings",
    PRODUCTS: "products",
    SALES: "sales",
    TRANSACTIONS: "product_transactions"
};

const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// --- VARIABLES DE ESTADO ---
let db, auth;
let userId = null;
let currentMonthDate = new Date();
let allMonthBookings = [];
let allProducts = []; // Local para búsqueda rápida
let currentSelectedProduct = null;
let currentBookingsUnsubscribe = null;

let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000
};

let recurringSettings = { dayOfWeek: null, months: [] };

// --- ELEMENTOS DEL DOM ---
const elements = {
    appContainer: document.getElementById('app-container'),
    loginView: document.getElementById('login-view'),
    registerView: document.getElementById('register-view'),
    calendarGrid: document.getElementById('calendar-grid'),
    currentMonthYear: document.getElementById('current-month-year'),
    bookingForm: document.getElementById('booking-form'),
    courtHoursList: document.getElementById('court-hours-list'),
    grillHoursList: document.getElementById('grill-hours-list'),
    productForm: document.getElementById('product-form'),
    productList: document.getElementById('product-list'),
    inventorySearch: document.getElementById('inventory-search-input'),
    saleModal: document.getElementById('sale-modal'),
    restockModal: document.getElementById('restock-modal'),
    historyModal: document.getElementById('product-history-modal'),
    editProductModal: document.getElementById('edit-product-modal'),
    messageOverlay: document.getElementById('message-overlay'),
    messageText: document.getElementById('message-text')
};

// -----------------------------------------------------------------
// 2. INICIALIZACIÓN
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    firebaseInit();
});

async function firebaseInit() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        await setPersistence(auth, browserLocalPersistence);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('user-email-display').textContent = user.email;
                await loadAppSettings();
                elements.appContainer.classList.remove('is-hidden');
                elements.loginView.classList.add('is-hidden');
                elements.registerView.classList.add('is-hidden');
                loadBookingsForMonth();
                syncProducts(); // Sincroniza stock e inventario
            } else {
                elements.appContainer.classList.add('is-hidden');
                elements.loginView.classList.remove('is-hidden');
            }
        });
    } catch (error) {
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 3. LISTENERS GLOBALES
// -----------------------------------------------------------------

function setupEventListeners() {
    // Navegación
    document.getElementById('menu-btn').onclick = toggleMenu;
    document.getElementById('menu-overlay').onclick = toggleMenu;
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => { showView(e.target.dataset.view); toggleMenu(); };
    });

    // Auth
    document.getElementById('login-form').onsubmit = handleLogin;
    document.getElementById('register-form').onsubmit = handleRegister;
    document.getElementById('logout-btn').onclick = () => signOut(auth);

    // Calendario
    document.getElementById('prev-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); };
    document.getElementById('next-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); };

    // Reserva
    elements.bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.querySelectorAll('input[name="courtSelection"]').forEach(r => r.onchange = updateCourtAvailability);
    document.getElementById('rentGrill').onchange = (e) => {
        document.getElementById('grill-hours-section').classList.toggle('is-hidden', !e.target.checked);
        updateTotalPrice();
    };

    // Recurrencia
    document.getElementById('recurring-toggle').onchange = openRecurringModal;
    document.getElementById('confirm-recurring-btn').onclick = saveRecurringSettings;
    document.querySelectorAll('.day-toggle-btn').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });

    // Inventario / Buffet
    document.getElementById('add-product-btn').onclick = () => document.getElementById('product-form-container').classList.toggle('is-hidden');
    document.getElementById('cancel-product-btn').onclick = () => document.getElementById('product-form-container').classList.add('is-hidden');
    elements.productForm.onsubmit = handleSaveProduct;
    elements.inventorySearch.oninput = () => renderProducts(elements.inventorySearch.value);

    // Modales Buffet
    document.getElementById('restock-form').onsubmit = handleConfirmRestock;
    document.getElementById('edit-product-form').onsubmit = handleConfirmEditProduct;

    // Venta Rápida
    document.getElementById('header-sale-btn').onclick = openSaleModal;
    document.getElementById('sale-search-input').oninput = handleSaleSearch;
    document.getElementById('sale-qty-minus').onclick = () => updateSaleQty(-1);
    document.getElementById('sale-qty-plus').onclick = () => updateSaleQty(1);
    document.getElementById('confirm-sale-btn').onclick = handleConfirmSale;
    document.getElementById('close-sale-modal-btn').onclick = closeModals;

    // Caja
    document.getElementById('caja-filter-btn').onclick = loadCajaData;
    document.getElementById('config-form').onsubmit = handleSaveConfig;
}

// -----------------------------------------------------------------
// 4. LÓGICA DE VISTAS
// -----------------------------------------------------------------

function toggleMenu() { 
    document.getElementById('main-menu').classList.toggle('is-open'); 
    document.getElementById('menu-overlay').classList.toggle('hidden');
}

function showView(viewName) {
    const views = ['calendar-view', 'caja-view', 'stats-view', 'historial-view', 'productos-view', 'config-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('is-hidden');
    });
    document.getElementById(viewName + '-view').classList.remove('is-hidden');
    
    if (viewName === 'configuracion') loadConfigIntoForm();
}

// -----------------------------------------------------------------
// 5. LÓGICA DE RESERVAS (CANCHAS Y CALENDARIO)
// -----------------------------------------------------------------

function loadBookingsForMonth() {
    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    elements.currentMonthYear.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(currentMonthDate);
    
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe();
    
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("monthYear", "==", monthYear));
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

function renderCalendar() {
    elements.calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Relleno mes anterior
    for (let i = 0; i < firstDay; i++) elements.calendarGrid.appendChild(createCell('', false));
    
    // Días reales
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
        elements.calendarGrid.appendChild(createCell(i, true, dayBookings, dateStr));
    }
}

function createCell(num, isCurrent, dayBookings = [], dateStr = '') {
    const cell = document.createElement('div');
    cell.className = `day-cell p-2 ${!isCurrent ? 'other-month-day' : 'cursor-pointer'}`;
    if (isCurrent) {
        cell.innerHTML = `<span class="font-black text-gray-700">${num}</span>`;
        if (dayBookings.length > 0) {
            cell.innerHTML += `<span class="booking-count">${dayBookings.length}</span>`;
        }
        cell.onclick = () => handleDayClick(dateStr, dayBookings);
    }
    return cell;
}

function handleDayClick(dateStr, dayBookings) {
    if (dayBookings.length === 0) {
        showBookingTypeSelection(dateStr);
    } else {
        showOptionsModal(dateStr, dayBookings);
    }
}

function showBookingTypeSelection(dateStr) {
    const modal = document.getElementById('type-modal');
    modal.dataset.date = dateStr;
    modal.classList.add('is-open');
}

function showBookingModal(dateStr, booking = null) {
    closeModals();
    elements.bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    document.getElementById('booking-id').value = booking ? booking.id : '';
    document.getElementById('booking-modal-title').textContent = booking ? "Editar Reserva" : `Nuevo Turno (${dateStr})`;
    
    // Precios
    document.getElementById('costPerHour').value = appSettings.court1Price;
    document.getElementById('grillCost').value = appSettings.grillPrice;

    if (booking) {
        document.getElementById('teamName').value = booking.teamName;
        document.getElementById('peopleCount').value = booking.peopleCount || 10;
        document.getElementById('costPerHour').value = booking.costPerHour;
        document.getElementById('rentGrill').checked = booking.rentGrill || false;
        if (booking.rentGrill) document.getElementById('grill-hours-section').classList.remove('is-hidden');
    }

    updateCourtAvailability();
    document.getElementById('booking-modal').classList.add('is-open');
}

function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const bookingId = document.getElementById('booking-id').value;
    
    // Actualizar precio sugerido por cancha
    document.getElementById('costPerHour').value = (courtId === 'cancha1') ? appSettings.court1Price : appSettings.court2Price;

    const occupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.courtId === courtId && b.id !== bookingId)
                    .forEach(b => b.courtHours?.forEach(h => occupied.add(h)));

    renderTimeSlots(elements.courtHoursList, occupied);
    
    // Si la parrilla está activa
    const grillOccupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.rentGrill && b.id !== bookingId)
                    .forEach(b => b.grillHours?.forEach(h => grillOccupied.add(h)));
    renderTimeSlots(document.getElementById('grill-hours-list'), grillOccupied);

    updateTotalPrice();
}

function renderTimeSlots(container, occupied) {
    container.innerHTML = '';
    OPERATING_HOURS.forEach(h => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `time-slot ${occupied.has(h) ? 'disabled' : ''}`;
        btn.textContent = `${h}:00`;
        if (!occupied.has(h)) {
            btn.onclick = () => { btn.classList.toggle('selected'); updateTotalPrice(); };
        }
        container.appendChild(btn);
    });
}

function updateTotalPrice() {
    const courtHours = elements.courtHoursList.querySelectorAll('.selected').length;
    const courtPrice = parseFloat(document.getElementById('costPerHour').value) || 0;
    const isGrill = document.getElementById('rentGrill').checked;
    const grillHours = document.getElementById('grill-hours-list').querySelectorAll('.selected').length;
    const grillPrice = parseFloat(document.getElementById('grillCost').value) || 0;

    const total = (courtHours * courtPrice) + (isGrill ? grillHours * grillPrice : 0);
    document.getElementById('booking-total').textContent = `$${total.toLocaleString('es-AR')}`;
    return total;
}

// -----------------------------------------------------------------
// 6. LÓGICA DE RECURRENCIA (MASIVA)
// -----------------------------------------------------------------

function openRecurringModal() {
    if (!document.getElementById('recurring-toggle').checked) return;
    const list = document.getElementById('recurring-month-list');
    list.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const d = new Date(); d.setMonth(d.getMonth() + i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-toggle-btn';
        btn.dataset.month = d.getMonth(); btn.dataset.year = d.getFullYear();
        btn.textContent = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
        btn.onclick = () => btn.classList.toggle('selected');
        list.appendChild(btn);
    }
    document.getElementById('recurring-modal').classList.add('is-open');
}

function saveRecurringSettings() {
    const dayBtn = document.querySelector('.day-toggle-btn.selected');
    const monthBtns = document.querySelectorAll('.month-toggle-btn.selected');
    if (!dayBtn || monthBtns.length === 0) return alert("Seleccioná un día y al menos un mes.");
    
    recurringSettings.dayOfWeek = parseInt(dayBtn.dataset.day);
    recurringSettings.months = Array.from(monthBtns).map(b => ({ month: parseInt(b.dataset.month), year: parseInt(b.dataset.year) }));
    
    document.getElementById('recurring-summary').textContent = `Repetir todos los ${WEEKDAYS[recurringSettings.dayOfWeek]}`;
    document.getElementById('recurring-summary').classList.remove('is-hidden');
    document.getElementById('recurring-modal').classList.remove('is-open');
}

// -----------------------------------------------------------------
// 7. GUARDADO DE RESERVAS (CON CONFLICTOS)
// -----------------------------------------------------------------

async function handleSaveBooking(e) {
    e.preventDefault();
    const saveBtn = e.target.querySelector('button[type="submit"]');
    saveBtn.disabled = true;

    if (document.getElementById('recurring-toggle').checked) {
        return handleSaveRecurringBooking(saveBtn);
    }

    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    if (selectedHours.length === 0) { saveBtn.disabled = false; return alert("Elegí al menos una hora."); }

    const bookingId = document.getElementById('booking-id').value;
    const data = {
        teamName: document.getElementById('teamName').value.trim(),
        courtId: document.querySelector('input[name="courtSelection"]:checked').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value),
        day: document.getElementById('booking-date').value,
        monthYear: document.getElementById('booking-date').value.substring(0, 7),
        courtHours: selectedHours,
        grillHours: Array.from(document.getElementById('grill-hours-list').querySelectorAll('.selected')).map(b => parseInt(b.textContent)),
        costPerHour: parseFloat(document.getElementById('costPerHour').value),
        totalPrice: updateTotalPrice(),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        rentGrill: document.getElementById('rentGrill').checked,
        timestamp: Timestamp.now(),
        createdBy: userId
    };

    try {
        if (bookingId) await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), data);
        else await addDoc(collection(db, COLLECTIONS.BOOKINGS), data);
        
        await saveCustomer(data.teamName);
        closeModals();
        showMessage("Reserva guardada.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
    finally { saveBtn.disabled = false; }
}

async function handleSaveRecurringBooking(btn) {
    showMessage("Generando reservas masivas...");
    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    
    // Validar conflictos contra TODOS los turnos (no solo los del mes cargado)
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("courtId", "==", courtId));
    const snap = await getDocs(q);
    const occupied = new Map();
    snap.forEach(d => {
        const b = d.data();
        if (!occupied.has(b.day)) occupied.set(b.day, new Set());
        b.courtHours?.forEach(h => occupied.get(b.day).add(h));
    });

    const batch = writeBatch(db);
    let created = 0, errors = 0;

    recurringSettings.months.forEach(m => {
        const days = new Date(m.year, m.month + 1, 0).getDate();
        for (let i = 1; i <= days; i++) {
            const d = new Date(m.year, m.month, i);
            if (d.getDay() === recurringSettings.dayOfWeek) {
                const dateStr = `${m.year}-${String(m.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                const isBusy = selectedHours.some(h => occupied.get(dateStr)?.has(h));
                if (isBusy) { errors++; } else {
                    const ref = doc(collection(db, COLLECTIONS.BOOKINGS));
                    batch.set(ref, { 
                        teamName, courtId, courtHours: selectedHours, day: dateStr, 
                        monthYear: dateStr.substring(0, 7), totalPrice: updateTotalPrice(),
                        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
                        timestamp: Timestamp.now()
                    });
                    created++;
                }
            }
        }
    });

    await batch.commit();
    btn.disabled = false;
    showMessage(`Creadas: ${created}. Fallidas por choque: ${errors}`);
    setTimeout(() => { closeModals(); hideMessage(); }, 3000);
}

// -----------------------------------------------------------------
// 8. GESTIÓN DE BUFFET (LÓGICA DE COSTO DE REPOSICIÓN)
// -----------------------------------------------------------------

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct').value) || 0;
    const unitCost = cost / qty;
    const salePrice = Math.ceil(unitCost * (1 + (profit / 100)));
    document.getElementById('prod-suggested-price').textContent = `$${salePrice}`;
    document.getElementById('prod-unit-cost').value = unitCost;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value);
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value);

    const data = {
        name, stock, unitCost, salePrice,
        createdAt: Timestamp.now()
    };

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), data);
        await logTransaction(docRef.id, 'Alta Inicial', stock, unitCost, 'in');
        elements.productForm.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto creado.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    });
}

function renderProducts(filter = "") {
    elements.productList.innerHTML = '';
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'}">Stock: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-gray-400 uppercase">Venta</p>
                    <p class="text-2xl font-black text-emerald-600">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid">
                <button class="card-action-btn" onclick="window.openRestock('${p.id}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    REPONER
                </button>
                <button class="card-action-btn" onclick="window.openHistory('${p.id}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    LOGS
                </button>
                <button class="card-action-btn" onclick="window.openEditProduct('${p.id}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    EDITAR
                </button>
                <button class="card-action-btn text-red-400" onclick="window.deleteProduct('${p.id}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    BORRAR
                </button>
            </div>
        `;
        elements.productList.appendChild(card);
    });
}

// -----------------------------------------------------------------
// 9. MODALES AVANZADOS DE PRODUCTO (REPOSICIÓN DIRECTA)
// -----------------------------------------------------------------

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    currentSelectedProduct = p;
    document.getElementById('restock-prod-id').value = id;
    document.getElementById('restock-name').textContent = p.name;
    document.getElementById('restock-current-stock').textContent = p.stock;
    elements.restockModal.classList.add('is-open');
};

async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    // Lógica de Reposición Directa (Actualiza todo al nuevo precio)
    const newUnitCost = batchCost / addQty;
    const p = allProducts.find(x => x.id === id);
    const newStock = p.stock + addQty;

    // Actualizar precio de venta manteniendo el % de ganancia previo si es posible o sugerir uno nuevo
    const profitFactor = p.salePrice / p.unitCost;
    const newSalePrice = Math.ceil(newUnitCost * profitFactor);

    try {
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
            stock: newStock,
            unitCost: newUnitCost,
            salePrice: newSalePrice
        });
        await logTransaction(id, `Reposición (${addQty} unidades)`, addQty, newUnitCost, 'in');
        closeModals();
        showMessage(`Stock actualizado. Nuevo precio venta: $${newSalePrice}`);
        setTimeout(hideMessage, 2500);
    } catch (err) { alert(err.message); }
}

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const list = document.getElementById('product-history-list');
    list.innerHTML = 'Cargando historial...';
    
    const q = query(collection(db, COLLECTIONS.TRANSACTIONS), where("productId", "==", id), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    
    list.innerHTML = '';
    snap.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString();
        const item = document.createElement('div');
        item.className = `history-item history-type-${t.type}`;
        item.innerHTML = `
            <div>
                <p class="font-black text-gray-800">${t.desc}</p>
                <p class="text-[10px] text-gray-400 font-bold uppercase">${date}</p>
            </div>
            <div class="text-right">
                <p class="font-black ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}">${t.type === 'in' ? '+' : '-'}${t.qty}</p>
                <p class="text-[10px] font-bold text-gray-300">$${t.cost || 0}/u</p>
            </div>
        `;
        list.appendChild(item);
    });
    elements.historyModal.classList.add('is-open');
};

window.openEditProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('edit-prod-id').value = id;
    document.getElementById('edit-prod-name').value = p.name;
    document.getElementById('edit-prod-cost').value = p.unitCost;
    document.getElementById('edit-prod-price').value = p.salePrice;
    document.getElementById('edit-prod-stock').value = p.stock;
    elements.editProductModal.classList.add('is-open');
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
    await logTransaction(id, 'Edición Manual', 0, data.unitCost, 'adj');
    closeModals();
}

// -----------------------------------------------------------------
// 10. VENTA RÁPIDA Y CAJA
// -----------------------------------------------------------------

function openSaleModal() {
    document.getElementById('sale-search-input').value = '';
    document.getElementById('sale-search-results').innerHTML = '';
    document.getElementById('selected-product-info').classList.add('is-hidden');
    document.getElementById('confirm-sale-btn').disabled = true;
    elements.saleModal.classList.add('is-open');
}

function handleSaleSearch() {
    const val = document.getElementById('sale-search-input').value.toLowerCase();
    if (val.length < 2) return;
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(val));
    const container = document.getElementById('sale-search-results');
    container.innerHTML = '';
    matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 transition-colors';
        item.innerHTML = `<span class="font-bold">${p.name} (Stock: ${p.stock})</span> <strong class="text-emerald-600">$${p.salePrice}</strong>`;
        item.onclick = () => selectProductForSale(p);
        container.appendChild(item);
    });
}

function selectProductForSale(p) {
    currentSelectedProduct = p;
    document.getElementById('sel-prod-name').textContent = p.name;
    document.getElementById('sel-prod-stock').textContent = p.stock;
    document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
    document.getElementById('sale-qty-input').value = 1;
    document.getElementById('selected-product-info').classList.remove('is-hidden');
    document.getElementById('confirm-sale-btn').disabled = p.stock <= 0;
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
    
    const saleData = {
        name: currentSelectedProduct.name,
        qty, total,
        day: new Date().toISOString().split('T')[0],
        timestamp: Timestamp.now(),
        type: 'buffet'
    };

    try {
        await addDoc(collection(db, COLLECTIONS.SALES), saleData);
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id), {
            stock: currentSelectedProduct.stock - qty
        });
        await logTransaction(currentSelectedProduct.id, 'Venta Buffet', qty, currentSelectedProduct.unitCost, 'out');
        closeModals();
        showMessage("¡Venta cobrada!");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

async function loadCajaData() {
    const from = document.getElementById('caja-date-from').value;
    const to = document.getElementById('caja-date-to').value;
    if (!from || !to) return;

    showMessage("Calculando...");
    try {
        const qB = query(collection(db, COLLECTIONS.BOOKINGS), where("day", ">=", from), where("day", "<=", to));
        const snapB = await getDocs(qB);
        let totalB = 0; snapB.forEach(d => totalB += d.data().totalPrice);

        const qS = query(collection(db, COLLECTIONS.SALES), where("day", ">=", from), where("day", "<=", to));
        const snapS = await getDocs(qS);
        let totalS = 0; snapS.forEach(d => totalS += d.data().total);

        document.getElementById('caja-total-bookings').textContent = `$${totalB.toLocaleString()}`;
        document.getElementById('caja-total-sales').textContent = `$${totalS.toLocaleString()}`;
        document.getElementById('caja-total-combined').textContent = `$${(totalB + totalS).toLocaleString()}`;
    } catch (err) { console.error(err); }
    finally { hideMessage(); }
}

// -----------------------------------------------------------------
// 11. UTILIDADES Y LOGS
// -----------------------------------------------------------------

async function logTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), {
        productId, desc, qty, cost, type,
        timestamp: Timestamp.now()
    });
}

async function handleLogin(e) { 
    e.preventDefault(); 
    showMessage("Ingresando...");
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
    catch(err) { alert("Error: " + err.message); hideMessage(); } 
}

async function handleRegister(e) {
    e.preventDefault();
    try { await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); }
    catch(err) { alert(err.message); }
}

async function loadAppSettings() {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "prices"));
    if (snap.exists()) appSettings = snap.data();
}

function loadConfigIntoForm() {
    document.getElementById('config-court1-price').value = appSettings.court1Price;
    document.getElementById('config-court2-price').value = appSettings.court2Price;
    document.getElementById('config-grill-price').value = appSettings.grillPrice;
}

async function handleSaveConfig(e) {
    e.preventDefault();
    const data = {
        court1Price: parseFloat(document.getElementById('config-court1-price').value),
        court2Price: parseFloat(document.getElementById('config-court2-price').value),
        grillPrice: parseFloat(document.getElementById('config-grill-price').value)
    };
    await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), data);
    appSettings = data;
    showMessage("Precios actualizados.");
    setTimeout(hideMessage, 1500);
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
    document.getElementById('recurring-toggle').checked = false;
    document.getElementById('recurring-summary').classList.add('is-hidden');
}

function showMessage(msg, isError = false) {
    elements.messageText.textContent = msg;
    elements.messageOverlay.classList.add('is-open');
}
function hideMessage() { elements.messageOverlay.classList.remove('is-open'); }

// Funciones globales expuestas para botones del DOM dinámico
window.deleteProduct = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id)); };
window.closeModals = closeModals;

async function saveCustomer(name) {
    if (!name) return;
    try {
        const id = name.trim().toLowerCase();
        await setDoc(doc(db, COLLECTIONS.CUSTOMERS, id), { name: name.trim(), updatedAt: Timestamp.now() }, { merge: true });
    } catch (err) { console.error(err); }
}

function showOptionsModal(dateStr, bookings) {
    const modal = document.getElementById('options-modal');
    modal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    list.innerHTML = '';
    bookings.forEach(b => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-gray-50 rounded-xl flex justify-between items-center border';
        div.innerHTML = `<div><p class="font-bold">${b.teamName}</p><p class="text-[10px] text-gray-400 uppercase">${b.courtId}</p></div>
                         <div class="flex gap-2">
                            <button class="text-blue-600 font-bold text-xs" onclick="window.viewBooking('${b.id}')">VER</button>
                            <button class="text-red-600 font-bold text-xs" onclick="window.deleteBooking('${b.id}')">BORRAR</button>
                         </div>`;
        list.appendChild(div);
    });
    modal.classList.add('is-open');
}

window.viewBooking = async (id) => {
    const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    if (snap.exists()) {
        const b = snap.data();
        document.getElementById('view-booking-details').innerHTML = `
            <h4 class="text-2xl font-black text-emerald-700">${b.teamName}</h4>
            <div class="mt-4 space-y-1 font-bold text-gray-600">
                <p>CANCHA: ${b.courtId.toUpperCase()}</p>
                <p>HORAS: ${b.courtHours?.join(', ')}hs</p>
                <p>PAGO: ${b.paymentMethod.toUpperCase()}</p>
                <p class="text-xl text-emerald-600 mt-2">TOTAL: $${b.totalPrice.toLocaleString()}</p>
            </div>
        `;
        document.getElementById('view-modal').classList.add('is-open');
    }
};

window.deleteBooking = async (id) => {
    if (confirm("¿Eliminar turno?")) {
        await deleteDoc(doc(db, COLLECTIONS.BOOKINGS, id));
        closeModals();
    }
};

async function handleTeamNameInput() {
    const val = document.getElementById('teamName').value.trim().toLowerCase();
    if (val.length < 2) { document.getElementById('teamName-suggestions').style.display = 'none'; return; }
    const q = query(collection(db, COLLECTIONS.CUSTOMERS), where(documentId(), ">=", val), where(documentId(), "<=", val + '\uf8ff'));
    const snap = await getDocs(q);
    const container = document.getElementById('teamName-suggestions');
    container.innerHTML = '';
    snap.forEach(d => {
        const item = document.createElement('div');
        item.className = 'p-3 hover:bg-emerald-50 cursor-pointer border-b font-bold text-sm';
        item.textContent = d.data().name;
        item.onmousedown = () => { document.getElementById('teamName').value = d.data().name; container.style.display = 'none'; };
        container.appendChild(item);
    });
    container.style.display = snap.empty ? 'none' : 'block';
}
