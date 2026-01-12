/**
 * APP.JS - SISTEMA DE GESTIÓN INTEGRAL "PANZA VERDE" - VERSIÓN 4.5
 * ----------------------------------------------------------------
 * Desarrollado para: Gestión de Canchas, Buffet, Stock y Caja.
 * Lógica de Reposición: Actualización directa de costo total al precio nuevo.
 */

// 1. IMPORTACIONES DE FIREBASE SDK (v11.6.1)
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
// 2. CONFIGURACIÓN E INICIALIZACIÓN INMEDIATA
// -----------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
    authDomain: "reserva-futsal.firebaseapp.com",
    projectId: "reserva-futsal",
    storageBucket: "reserva-futsal.firebasestorage.app",
    messagingSenderId: "285845706235",
    appId: "1:285845706235:web:9355804aea8181b030275e"
};

// Inicialización de servicios core
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// -----------------------------------------------------------------
// 3. CONSTANTES Y ESTADO GLOBAL
// -----------------------------------------------------------------
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
const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Estado de la aplicación
let userId = null;
let userEmail = null;
let currentMonthDate = new Date();
let allMonthBookings = [];
let allProducts = []; 
let currentSelectedProduct = null;
let currentBookingsUnsubscribe = null;

// Configuración de precios inicial
let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

// Configuración de recurrencia temporal
let recurringSettings = {
    dayOfWeek: null,
    months: []
};

// -----------------------------------------------------------------
// 4. CICLO DE VIDA (DOM CONTENT LOADED)
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Iniciando aplicación...");
    
    // 1. Configurar Listeners primero (con seguridad para evitar crasheos)
    setupSafeEventListeners();
    
    // 2. Configurar persistencia de sesión
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (e) {
        console.error("Error persistencia:", e);
    }
    
    // 3. Observador de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Acceso concedido:", user.email);
            userId = user.uid;
            userEmail = user.email;
            
            const emailDisplay = document.getElementById('user-email-display');
            if (emailDisplay) emailDisplay.textContent = userEmail;
            
            // Cargar datos del servidor
            await loadAppSettings();
            
            // Mostrar interfaz principal
            toggleAppVisibility(true);
            
            // Iniciar sincronización en tiempo real
            loadBookingsForMonth();
            syncProducts(); 
        } else {
            console.log("Esperando inicio de sesión...");
            toggleAppVisibility(false);
        }
    });

    // 4. Registrar/Actualizar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => reg.update());
    }
});

// -----------------------------------------------------------------
// 5. MANEJO DE EVENTOS (ROBUSTO)
// -----------------------------------------------------------------

function setupSafeEventListeners() {
    // Función auxiliar para evitar errores de 'null'
    const addListener = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
        else console.warn(`Elemento no encontrado: ${id}`);
    };

    // Navegación y Menú
    addListener('menu-btn', 'click', toggleMenu);
    addListener('menu-overlay', 'click', toggleMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            const target = e.currentTarget.dataset.view;
            showView(target);
            toggleMenu();
        };
    });

    // Autenticación
    addListener('login-form', 'submit', handleLogin);
    addListener('register-form', 'submit', handleRegister);
    addListener('logout-btn', 'click', () => signOut(auth));
    addListener('show-register', 'click', (e) => {
        e.preventDefault();
        document.getElementById('login-view').classList.add('is-hidden');
        document.getElementById('register-view').classList.remove('is-hidden');
    });
    addListener('show-login', 'click', (e) => {
        e.preventDefault();
        document.getElementById('register-view').classList.add('is-hidden');
        document.getElementById('login-view').classList.remove('is-hidden');
    });

    // Calendario
    addListener('prev-month-btn', 'click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        loadBookingsForMonth();
    });
    addListener('next-month-btn', 'click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        loadBookingsForMonth();
    });

    // Reservas
    addListener('booking-form', 'submit', handleSaveBooking);
    addListener('cancel-booking-btn', 'click', closeModals);
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => {
        radio.onchange = updateCourtAvailability;
    });
    addListener('rentGrill', 'change', (e) => {
        const section = document.getElementById('grill-hours-section');
        if (section) section.classList.toggle('is-hidden', !e.target.checked);
        updateTotalPrice();
    });
    addListener('costPerHour', 'input', updateTotalPrice);
    addListener('grillCost', 'input', updateTotalPrice);
    addListener('teamName', 'input', handleTeamNameInput);

    // Recurrencia
    addListener('recurring-toggle', 'change', openRecurringModal);
    addListener('confirm-recurring-btn', 'click', saveRecurringSettings);
    addListener('cancel-recurring-btn', 'click', () => {
        const toggle = document.getElementById('recurring-toggle');
        if (toggle) toggle.checked = false;
        closeModals();
    });
    document.querySelectorAll('.day-toggle-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
    });

    // Inventario y Buffet
    addListener('add-product-btn', 'click', () => {
        const container = document.getElementById('product-form-container');
        if (container) container.classList.toggle('is-hidden');
    });
    addListener('cancel-product-btn', 'click', () => {
        const container = document.getElementById('product-form-container');
        if (container) container.classList.add('is-hidden');
    });
    addListener('product-form', 'submit', handleSaveProduct);
    addListener('inventory-search-input', 'input', (e) => renderProducts(e.target.value));
    
    // Cálculo automático de buffet
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        addListener(id, 'input', calculateProductPrices);
    });

    // Venta Buffet
    addListener('header-sale-btn', 'click', openSaleModal);
    addListener('sale-search-input', 'input', handleSaleSearch);
    addListener('sale-qty-minus', 'click', () => updateSaleQty(-1));
    addListener('sale-qty-plus', 'click', () => updateSaleQty(1));
    addListener('confirm-sale-btn', 'click', handleConfirmSale);
    addListener('close-sale-modal-btn', 'click', closeModals);

    // Reposición y Edición Manual
    addListener('restock-form', 'submit', handleConfirmRestock);
    addListener('edit-product-form', 'submit', handleConfirmEditProduct);

    // Caja y Filtros
    addListener('caja-filter-btn', 'click', loadCajaData);
    addListener('config-form', 'submit', handleSaveConfig);
}

// -----------------------------------------------------------------
// 6. LÓGICA DE VISTAS Y NAVEGACIÓN
// -----------------------------------------------------------------

function toggleAppVisibility(isLoggedIn) {
    const appContainer = document.getElementById('app-container');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    if (isLoggedIn) {
        if (appContainer) appContainer.classList.remove('is-hidden');
        if (loginView) loginView.classList.add('is-hidden');
        if (registerView) registerView.classList.add('is-hidden');
    } else {
        if (appContainer) appContainer.classList.add('is-hidden');
        if (loginView) loginView.classList.remove('is-hidden');
    }
}

function toggleMenu() { 
    const menu = document.getElementById('main-menu');
    const overlay = document.getElementById('menu-overlay');
    if (menu) menu.classList.toggle('is-open'); 
    if (overlay) overlay.classList.toggle('hidden');
}

function showView(viewName) {
    const views = ['calendar-view', 'caja-view', 'stats-view', 'historial-view', 'productos-view', 'config-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('is-hidden');
    });
    
    const target = document.getElementById(viewName + '-view');
    if (target) {
        target.classList.remove('is-hidden');
    }
    
    if (viewName === 'configuracion') loadConfigIntoForm();
    if (viewName === 'caja') loadCajaData();
    if (viewName === 'productos') renderProducts();
}

// -----------------------------------------------------------------
// 7. LÓGICA DE CALENDARIO Y RESERVAS
// -----------------------------------------------------------------

function loadBookingsForMonth() {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth() + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    
    const titleEl = document.getElementById('current-month-year');
    if (titleEl) titleEl.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(currentMonthDate);
    
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe();
    
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("monthYear", "==", monthYear));
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Relleno mes anterior
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell other-month-day opacity-20';
        grid.appendChild(emptyCell);
    }
    
    // Días reales del mes
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
        
        const cell = document.createElement('div');
        cell.className = 'day-cell p-2 bg-white cursor-pointer relative flex flex-col items-center justify-center';
        cell.innerHTML = `<span class="font-black text-gray-700">${i}</span>`;
        
        if (dayBookings.length > 0) {
            cell.innerHTML += `<span class="booking-count">${dayBookings.length}</span>`;
        }
        
        cell.onclick = () => {
            if (dayBookings.length === 0) {
                const modal = document.getElementById('type-modal');
                if (modal) {
                    modal.dataset.date = dateStr;
                    modal.classList.add('is-open');
                }
            } else {
                showOptionsModal(dateStr, dayBookings);
            }
        };
        grid.appendChild(cell);
    }
}

// -----------------------------------------------------------------
// 8. LÓGICA DE FORMULARIO DE RESERVA
// -----------------------------------------------------------------

function showBookingModal(dateStr, booking = null) {
    closeModals();
    const form = document.getElementById('booking-form');
    if (form) form.reset();

    const dateInput = document.getElementById('booking-date');
    const idInput = document.getElementById('booking-id');
    const title = document.getElementById('booking-modal-title');
    
    if (dateInput) dateInput.value = dateStr;
    if (idInput) idInput.value = booking ? booking.id : '';
    if (title) title.textContent = booking ? "Editar Reserva" : `Nuevo Turno (${dateStr})`;
    
    // Configuración inicial de precios
    const costInput = document.getElementById('costPerHour');
    const grillInput = document.getElementById('grillCost');
    if (costInput) costInput.value = appSettings.court1Price;
    if (grillInput) grillInput.value = appSettings.grillPrice;

    updateCourtAvailability();
    const modal = document.getElementById('booking-modal');
    if (modal) modal.classList.add('is-open');
}

function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const courtSelector = document.querySelector('input[name="courtSelection"]:checked');
    if (!courtSelector) return;

    const courtId = courtSelector.value;
    const bookingId = document.getElementById('booking-id').value;
    
    // Actualizar precio sugerido por cancha
    const costInput = document.getElementById('costPerHour');
    if (costInput) costInput.value = (courtId === 'cancha1') ? appSettings.court1Price : appSettings.court2Price;

    // Horas de cancha ocupadas
    const occupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.courtId === courtId && b.id !== bookingId)
                    .forEach(b => b.courtHours?.forEach(h => occupied.add(h)));

    renderTimeSlots(document.getElementById('court-hours-list'), occupied);
    
    // Horas de parrilla ocupadas
    const grillOccupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.rentGrill && b.id !== bookingId)
                    .forEach(b => b.grillHours?.forEach(h => grillOccupied.add(h)));
    renderTimeSlots(document.getElementById('grill-hours-list'), grillOccupied);

    updateTotalPrice();
}

function renderTimeSlots(container, occupied) {
    if (!container) return;
    container.innerHTML = '';
    OPERATING_HOURS.forEach(h => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `time-slot ${occupied.has(h) ? 'disabled' : ''}`;
        btn.textContent = `${h}:00`;
        if (!occupied.has(h)) {
            btn.onclick = (e) => { 
                e.target.classList.toggle('selected'); 
                updateTotalPrice(); 
            };
        }
        container.appendChild(btn);
    });
}

function updateTotalPrice() {
    const courtList = document.getElementById('court-hours-list');
    const grillList = document.getElementById('grill-hours-list');
    
    const courtHoursCount = courtList ? courtList.querySelectorAll('.selected').length : 0;
    const courtPrice = parseFloat(document.getElementById('costPerHour').value) || 0;
    
    const isGrillActive = document.getElementById('rentGrill')?.checked || false;
    const grillHoursCount = grillList ? grillList.querySelectorAll('.selected').length : 0;
    const grillPrice = parseFloat(document.getElementById('grillCost')?.value) || 0;

    const total = (courtHoursCount * courtPrice) + (isGrillActive ? grillHoursCount * grillPrice : 0);
    
    const totalDisplay = document.getElementById('booking-total');
    if (totalDisplay) totalDisplay.textContent = `$${total.toLocaleString('es-AR')}`;
    return total;
}

// -----------------------------------------------------------------
// 9. LÓGICA DE RECURRENCIA (SISTEMA DE RESERVAS MASIVAS)
// -----------------------------------------------------------------

function openRecurringModal() {
    const toggle = document.getElementById('recurring-toggle');
    if (!toggle || !toggle.checked) return;
    
    const monthList = document.getElementById('recurring-month-list');
    if (!monthList) return;
    monthList.innerHTML = '';
    
    // Generar próximos 12 meses
    for (let i = 0; i < 12; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-toggle-btn';
        btn.dataset.month = d.getMonth();
        btn.dataset.year = d.getFullYear();
        btn.textContent = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
        btn.onclick = (e) => e.target.classList.toggle('selected');
        monthList.appendChild(btn);
    }
    
    const modal = document.getElementById('recurring-modal');
    if (modal) modal.classList.add('is-open');
}

function saveRecurringSettings() {
    const selectedDayBtn = document.querySelector('.day-toggle-btn.selected');
    const selectedMonthBtns = document.querySelectorAll('.month-toggle-btn.selected');
    
    if (!selectedDayBtn || selectedMonthBtns.length === 0) {
        return alert("Debes seleccionar un día de la semana y al menos un mes.");
    }

    recurringSettings.dayOfWeek = parseInt(selectedDayBtn.dataset.day);
    recurringSettings.months = Array.from(selectedMonthBtns).map(b => ({
        month: parseInt(b.dataset.month),
        year: parseInt(b.dataset.year)
    }));

    const summary = document.getElementById('recurring-summary');
    if (summary) {
        summary.textContent = `Se repetirá cada ${WEEKDAYS_ES[recurringSettings.dayOfWeek]}`;
        summary.classList.remove('is-hidden');
    }
    
    const modal = document.getElementById('recurring-modal');
    if (modal) modal.classList.remove('is-open');
}

// -----------------------------------------------------------------
// 10. LÓGICA DE GUARDADO DE RESERVAS
// -----------------------------------------------------------------

async function handleSaveBooking(e) {
    e.preventDefault();
    const saveBtn = e.target.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.disabled = true;

    // Verificar si es masivo o simple
    const isRecurring = document.getElementById('recurring-toggle')?.checked || false;
    if (isRecurring) {
        return handleSaveRecurringBooking(saveBtn);
    }

    const courtList = document.getElementById('court-hours-list');
    const selectedHours = courtList ? Array.from(courtList.querySelectorAll('.selected')).map(b => parseInt(b.textContent)) : [];
    
    if (selectedHours.length === 0) {
        if (saveBtn) saveBtn.disabled = false;
        return alert("Seleccioná al menos un horario de cancha.");
    }

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    
    const data = {
        teamName: document.getElementById('teamName').value.trim(),
        courtId: document.querySelector('input[name="courtSelection"]:checked').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value) || 10,
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
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
        if (bookingId) {
            await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), data);
        } else {
            await addDoc(collection(db, COLLECTIONS.BOOKINGS), data);
        }
        
        await saveCustomer(data.teamName);
        closeModals();
        showMessage("Reserva guardada correctamente.");
        setTimeout(hideMessage, 1500);
    } catch (err) {
        alert("Error al guardar: " + err.message);
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function handleSaveRecurringBooking(btn) {
    showMessage("Analizando disponibilidad masiva...");
    
    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedHours = Array.from(document.getElementById('court-hours-list').querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    
    // Obtener todas las reservas de la cancha elegida para evitar colisiones
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("courtId", "==", courtId));
    const snap = await getDocs(q);
    const occupiedMap = new Map();
    snap.forEach(d => {
        const b = d.data();
        if (!occupiedMap.has(b.day)) occupiedMap.set(b.day, new Set());
        b.courtHours?.forEach(h => occupiedMap.get(b.day).add(h));
    });

    const batch = writeBatch(db);
    let created = 0;
    let conflicts = 0;

    recurringSettings.months.forEach(m => {
        const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(m.year, m.month, i);
            if (date.getDay() === recurringSettings.dayOfWeek) {
                const dateStr = `${m.year}-${String(m.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                
                // Comprobar si choca
                const dayBusy = occupiedMap.get(dateStr) || new Set();
                const isConflict = selectedHours.some(h => dayBusy.has(h));
                
                if (isConflict) {
                    conflicts++;
                } else {
                    const ref = doc(collection(db, COLLECTIONS.BOOKINGS));
                    batch.set(ref, { 
                        teamName, 
                        courtId, 
                        courtHours: selectedHours, 
                        day: dateStr, 
                        monthYear: dateStr.substring(0, 7), 
                        totalPrice: updateTotalPrice(),
                        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
                        timestamp: Timestamp.now()
                    });
                    created++;
                }
            }
        }
    });

    try {
        if (created > 0) await batch.commit();
        await saveCustomer(teamName);
        showMessage(`Proceso finalizado. Creadas: ${created}. Fallidas por choque: ${conflicts}`);
    } catch (err) {
        alert("Error masivo: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
        setTimeout(() => { closeModals(); hideMessage(); }, 3000);
    }
}

// -----------------------------------------------------------------
// 11. GESTIÓN DE BUFFET (INVENTARIO Y VENTAS)
// -----------------------------------------------------------------

/**
 * Lógica de Costo de Reposición Directo: 
 * Al ingresar stock nuevo, TODO el stock anterior pasa a valer lo mismo que el nuevo.
 */
function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost')?.value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty')?.value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct')?.value) || 0;
    
    const unitCost = cost / qty;
    const salePrice = Math.ceil(unitCost * (1 + (profit / 100)));
    
    const display = document.getElementById('prod-suggested-price');
    if (display) display.textContent = `$${salePrice}`;
    
    const hiddenCost = document.getElementById('prod-unit-cost');
    if (hiddenCost) hiddenCost.value = unitCost;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value) || 0;
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', '')) || 0;

    const data = { name, stock, unitCost, salePrice, createdAt: Timestamp.now() };

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), data);
        await logTransaction(docRef.id, 'Alta Inicial', stock, unitCost, 'in');
        
        e.target.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto guardado.");
        setTimeout(hideMessage, 1500);
    } catch (err) {
        alert("Error de permisos Firestore: " + err.message);
    }
}

function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(document.getElementById('inventory-search-input')?.value || "");
    });
}

function renderProducts(filter = "") {
    const list = document.getElementById('product-list');
    if (!list) return;
    list.innerHTML = '';
    
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'}">Stock: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-tighter">P. Venta</p>
                    <p class="text-2xl font-black text-emerald-600">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid">
                <button class="card-action-btn" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn text-red-500" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// LÓGICA DE REPOSICIÓN DIRECTA (ACTUALIZA TODO AL PRECIO NUEVO)
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    const newUnitCost = batchCost / addQty;
    const p = allProducts.find(x => x.id === id);
    const newStockTotal = p.stock + addQty;

    // Ajustar precio de venta automáticamente según el margen que tenía
    const margin = p.salePrice / p.unitCost; 
    const newSalePrice = Math.ceil(newUnitCost * margin);

    try {
        showMessage("Actualizando precios de todo el stock...");
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
            stock: newStockTotal,
            unitCost: newUnitCost, // Reposición: el stock viejo ahora vale lo que el nuevo
            salePrice: newSalePrice
        });
        
        await logTransaction(id, `Reposición (+${addQty})`, addQty, newUnitCost, 'in');
        closeModals();
        showMessage("Inventario actualizado.");
        setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 12. VENTA RÁPIDA (MODAL)
// -----------------------------------------------------------------

function openSaleModal() {
    const search = document.getElementById('sale-search-input');
    if (search) search.value = '';
    
    const results = document.getElementById('sale-search-results');
    if (results) results.innerHTML = '';
    
    const info = document.getElementById('selected-product-info');
    if (info) info.classList.add('is-hidden');
    
    const btn = document.getElementById('confirm-sale-btn');
    if (btn) btn.disabled = true;
    
    const modal = document.getElementById('sale-modal');
    if (modal) modal.classList.add('is-open');
}

function handleSaleSearch() {
    const val = document.getElementById('sale-search-input').value.toLowerCase();
    const container = document.getElementById('sale-search-results');
    if (!container) return;
    
    if (val.length < 2) {
        container.innerHTML = '';
        return;
    }
    
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(val));
    container.innerHTML = '';
    
    matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200 mb-2';
        item.innerHTML = `
            <div>
                <span class="font-black text-gray-800">${p.name}</span>
                <p class="text-[10px] font-bold text-gray-400 uppercase">DISPONIBLES: ${p.stock}</p>
            </div>
            <strong class="text-emerald-600 text-lg">$${p.salePrice}</strong>
        `;
        item.onclick = () => {
            currentSelectedProduct = p;
            document.getElementById('sel-prod-name').textContent = p.name;
            document.getElementById('sel-prod-stock').textContent = p.stock;
            document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
            document.getElementById('sale-qty-input').value = 1;
            document.getElementById('selected-product-info').classList.remove('is-hidden');
            document.getElementById('confirm-sale-btn').disabled = (p.stock <= 0);
            updateSaleTotal();
        };
        container.appendChild(item);
    });
}

function updateSaleQty(delta) {
    const input = document.getElementById('sale-qty-input');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (val > currentSelectedProduct.stock) val = currentSelectedProduct.stock;
    input.value = val;
    updateSaleTotal();
}

function updateSaleTotal() {
    const qtyInput = document.getElementById('sale-qty-input');
    const display = document.getElementById('sale-total-display');
    if (qtyInput && display && currentSelectedProduct) {
        const total = parseInt(qtyInput.value) * currentSelectedProduct.salePrice;
        display.textContent = `$${total.toLocaleString('es-AR')}`;
    }
}

async function handleConfirmSale() {
    const qty = parseInt(document.getElementById('sale-qty-input').value);
    const total = qty * currentSelectedProduct.salePrice;
    
    try {
        showMessage("Registrando venta...");
        // 1. Venta
        await addDoc(collection(db, COLLECTIONS.SALES), {
            name: currentSelectedProduct.name,
            qty, total,
            day: new Date().toISOString().split('T')[0],
            monthYear: new Date().toISOString().substring(0, 7),
            timestamp: Timestamp.now(),
            type: 'buffet'
        });
        // 2. Stock
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id), {
            stock: currentSelectedProduct.stock - qty
        });
        // 3. Log
        await logTransaction(currentSelectedProduct.id, 'Venta Buffet', qty, currentSelectedProduct.unitCost, 'out');
        
        closeModals();
        showMessage("¡Venta cobrada!");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 13. CAJA UNIFICADA
// -----------------------------------------------------------------

async function loadCajaData() {
    const from = document.getElementById('caja-date-from')?.value;
    const to = document.getElementById('caja-date-to')?.value;
    if (!from || !to) return;

    showMessage("Consultando balance...");
    try {
        const qB = query(collection(db, COLLECTIONS.BOOKINGS), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, COLLECTIONS.SALES), where("day", ">=", from), where("day", "<=", to));
        
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let totalB = 0; snapB.forEach(d => totalB += (d.data().totalPrice || 0));
        let totalS = 0; snapS.forEach(d => totalS += (d.data().total || 0));

        const elB = document.getElementById('caja-total-bookings');
        const elS = document.getElementById('caja-total-sales');
        const elC = document.getElementById('caja-total-combined');
        
        if (elB) elB.textContent = `$${totalB.toLocaleString('es-AR')}`;
        if (elS) elS.textContent = `$${totalS.toLocaleString('es-AR')}`;
        if (elC) elC.textContent = `$${(totalB + totalS).toLocaleString('es-AR')}`;
        
    } catch (err) { console.error(err); }
    finally { hideMessage(); }
}

// -----------------------------------------------------------------
// 14. UTILIDADES Y LOGS
// -----------------------------------------------------------------

async function logTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), {
        productId, desc, qty, cost, type, timestamp: Timestamp.now()
    });
}

async function handleLogin(e) { 
    e.preventDefault(); 
    showMessage("Validando acceso...");
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
    } catch(err) { 
        alert("Acceso denegado: " + err.message); 
        hideMessage(); 
    } 
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
    const c1 = document.getElementById('config-court1-price');
    const c2 = document.getElementById('config-court2-price');
    const gr = document.getElementById('config-grill-price');
    if (c1) c1.value = appSettings.court1Price;
    if (c2) c2.value = appSettings.court2Price;
    if (gr) gr.value = appSettings.grillPrice;
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
    showMessage("Configuración guardada.");
    setTimeout(hideMessage, 1500);
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
    const rt = document.getElementById('recurring-toggle');
    if (rt) rt.checked = false;
    const rs = document.getElementById('recurring-summary');
    if (rs) rs.classList.add('is-hidden');
}

function showMessage(msg) {
    const txt = document.getElementById('message-text');
    const ovl = document.getElementById('message-overlay');
    if (txt) txt.textContent = msg;
    if (ovl) ovl.classList.add('is-open');
}

function hideMessage() { 
    const ovl = document.getElementById('message-overlay');
    if (ovl) ovl.classList.remove('is-open'); 
}

// FUNCIONES GLOBALES PARA EL DOM DINÁMICO
window.deleteProduct = async (id) => { if(confirm("¿Eliminar producto?")) await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id)); };
window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    currentSelectedProduct = p;
    document.getElementById('restock-prod-id').value = id;
    document.getElementById('restock-name').textContent = p.name;
    document.getElementById('restock-current-stock').textContent = p.stock;
    document.getElementById('restock-modal').classList.add('is-open');
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
window.deleteBooking = async (id) => { if (confirm("¿Borrar turno?")) { await deleteDoc(doc(db, COLLECTIONS.BOOKINGS, id)); closeModals(); } };
window.closeModals = closeModals;

// -----------------------------------------------------------------
// 15. CLIENTES Y OPCIONES
// -----------------------------------------------------------------

async function saveCustomer(name) {
    if (!name) return;
    try { await setDoc(doc(db, COLLECTIONS.CUSTOMERS, name.trim().toLowerCase()), { name: name.trim(), updatedAt: Timestamp.now() }, { merge: true }); } catch (err) {}
}

async function handleTeamNameInput() {
    const val = document.getElementById('teamName').value.trim().toLowerCase();
    const container = document.getElementById('teamName-suggestions');
    if (!container) return;
    if (val.length < 2) { container.style.display = 'none'; return; }
    
    const q = query(collection(db, COLLECTIONS.CUSTOMERS), where(documentId(), ">=", val), where(documentId(), "<=", val + '\uf8ff'));
    const snap = await getDocs(q);
    container.innerHTML = '';
    snap.forEach(d => {
        const item = document.createElement('div');
        item.className = 'p-3 hover:bg-emerald-50 cursor-pointer border-b font-bold text-sm';
        item.textContent = d.data().name;
        item.onmousedown = () => { 
            document.getElementById('teamName').value = d.data().name; 
            container.style.display = 'none'; 
        };
        container.appendChild(item);
    });
    container.style.display = snap.empty ? 'none' : 'block';
}

function showOptionsModal(dateStr, bookings) {
    const modal = document.getElementById('options-modal');
    if (!modal) return;
    modal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    if (list) {
        list.innerHTML = '';
        bookings.forEach(b => {
            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100 mb-2 shadow-sm';
            div.innerHTML = `<div><p class="font-black text-gray-800">${b.teamName}</p><p class="text-[10px] text-gray-400 uppercase tracking-widest">${b.courtId}</p></div>
                             <div class="flex gap-2">
                                <button class="text-blue-600 font-black text-xs bg-white px-4 py-2 rounded-xl shadow-sm" onclick="window.viewBooking('${b.id}')">VER</button>
                                <button class="text-red-500 font-black text-xs bg-white px-4 py-2 rounded-xl shadow-sm" onclick="window.deleteBooking('${b.id}')">BORRAR</button>
                             </div>`;
            list.appendChild(div);
        });
    }
    modal.classList.add('is-open');
}

window.viewBooking = async (id) => {
    const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    if (snap.exists()) {
        const b = snap.data();
        const details = document.getElementById('view-booking-details');
        if (details) {
            details.innerHTML = `<h4 class="text-2xl font-black text-emerald-700">${b.teamName}</h4><p class="font-bold text-gray-500 uppercase text-xs">${b.courtId}</p>
                                <div class="mt-4 border-t pt-4 space-y-2">
                                    <p class="flex justify-between font-bold"><span>HORAS:</span> <span>${b.courtHours?.join(', ')}hs</span></p>
                                    <p class="flex justify-between font-bold"><span>PAGO:</span> <span>${b.paymentMethod?.toUpperCase()}</span></p>
                                    <p class="flex justify-between text-xl font-black text-emerald-600 pt-2"><span>TOTAL:</span> <span>$${b.totalPrice?.toLocaleString()}</span></p>
                                </div>`;
        }
        const modal = document.getElementById('view-modal');
        if (modal) modal.classList.add('is-open');
    }
};

window.openEditProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    if (p) {
        document.getElementById('edit-prod-id').value = id;
        document.getElementById('edit-prod-name').value = p.name;
        document.getElementById('edit-prod-cost').value = p.unitCost;
        document.getElementById('edit-prod-price').value = p.salePrice;
        document.getElementById('edit-prod-stock').value = p.stock;
        document.getElementById('edit-product-modal').classList.add('is-open');
    }
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

console.log("Sistema cargado al 100% con seguridad DOM.");
