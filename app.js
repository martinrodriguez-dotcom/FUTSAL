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

// --- CONSTANTES DE LA APP ---
const COLLECTIONS = {
    BOOKINGS: "bookings",
    CUSTOMERS: "customers",
    LOGS: "booking_log",
    SETTINGS: "app_settings",
    PRODUCTS: "products",
    SALES: "sales"
};

const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// --- VARIABLES GLOBALES ---
let db, auth;
let userId = null;
let userEmail = null;
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = [];
let currentSelectedProduct = null;
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Configuración de precios (Defaults)
let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

// Estado de recurrencia
let recurringSettings = {
    dayOfWeek: null,
    months: []
};

// --- REFERENCIAS AL DOM ---
const elements = {
    // Vistas Principales
    views: {
        calendar: document.getElementById('calendar-view'),
        caja: document.getElementById('caja-view'),
        stats: document.getElementById('stats-view'),
        historial: document.getElementById('historial-view'),
        productos: document.getElementById('productos-view'),
        configuracion: document.getElementById('config-view')
    },
    // Contenedores
    loginView: document.getElementById('login-view'),
    registerView: document.getElementById('register-view'),
    appContainer: document.getElementById('app-container'),
    // Calendario
    calendarGrid: document.getElementById('calendar-grid'),
    currentMonthYear: document.getElementById('current-month-year'),
    // Modales
    typeModal: document.getElementById('type-modal'),
    bookingModal: document.getElementById('booking-modal'),
    eventModal: document.getElementById('event-modal'),
    optionsModal: document.getElementById('options-modal'),
    viewModal: document.getElementById('view-modal'),
    cajaDetailModal: document.getElementById('caja-detail-modal'),
    deleteReasonModal: document.getElementById('delete-reason-modal'),
    recurringModal: document.getElementById('recurring-modal'),
    saleModal: document.getElementById('sale-modal'),
    messageOverlay: document.getElementById('message-overlay'),
    // Formularios Reserva
    bookingForm: document.getElementById('booking-form'),
    teamNameInput: document.getElementById('teamName'),
    teamNameSuggestions: document.getElementById('teamName-suggestions'),
    recurringToggle: document.getElementById('recurring-toggle'),
    recurringSummary: document.getElementById('recurring-summary'),
    courtHoursList: document.getElementById('court-hours-list'),
    grillHoursList: document.getElementById('grill-hours-list'),
    bookingTotal: document.getElementById('booking-total'),
    // Inventario
    productForm: document.getElementById('product-form'),
    productList: document.getElementById('product-list'),
    productFormContainer: document.getElementById('product-form-container'),
    // Venta
    saleSearchInput: document.getElementById('sale-search-input'),
    saleSearchResults: document.getElementById('sale-search-results'),
    selectedProductInfo: document.getElementById('selected-product-info'),
    confirmSaleBtn: document.getElementById('confirm-sale-btn')
};

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando App Integral...");
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
                console.log("Usuario autenticado:", user.email);
                userId = user.uid;
                userEmail = user.email;
                document.getElementById('user-email-display').textContent = userEmail;
                
                await loadAppSettings();
                elements.appContainer.classList.remove('is-hidden');
                elements.loginView.classList.add('is-hidden');
                elements.registerView.classList.add('is-hidden');
                
                loadBookingsForMonth();
                syncProducts();
            } else {
                console.log("Sin usuario, redirigiendo a Login.");
                elements.appContainer.classList.add('is-hidden');
                elements.loginView.classList.remove('is-hidden');
            }
        });
    } catch (error) {
        console.error("Error Firebase Init:", error);
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 2. LISTENERS DE EVENTOS
// -----------------------------------------------------------------

function setupEventListeners() {
    // Menú Hamburguesa
    document.getElementById('menu-btn').onclick = toggleMenu;
    document.getElementById('menu-overlay').onclick = toggleMenu;
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            const viewName = e.target.dataset.view;
            showView(viewName);
            toggleMenu();
        };
    });

    // Autenticación
    document.getElementById('login-form').onsubmit = handleLogin;
    document.getElementById('register-form').onsubmit = handleRegister;
    document.getElementById('logout-btn').onclick = () => signOut(auth);
    document.getElementById('show-register').onclick = (e) => { e.preventDefault(); elements.loginView.classList.add('is-hidden'); elements.registerView.classList.remove('is-hidden'); };
    document.getElementById('show-login').onclick = (e) => { e.preventDefault(); elements.registerView.classList.add('is-hidden'); elements.loginView.classList.remove('is-hidden'); };

    // Navegación Calendario
    document.getElementById('prev-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); };
    document.getElementById('next-month-btn').onclick = () => { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); };

    // Reservas Cancha
    elements.bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => radio.onchange = updateCourtAvailability);
    document.getElementById('rentGrill').onchange = (e) => {
        document.getElementById('grill-hours-section').classList.toggle('is-hidden', !e.target.checked);
        updateTotalPrice();
    };
    document.getElementById('costPerHour').oninput = updateTotalPrice;
    document.getElementById('grillCost').oninput = updateTotalPrice;
    
    // Sugerencias de Nombres
    elements.teamNameInput.oninput = handleTeamNameInput;
    elements.teamNameInput.onblur = () => setTimeout(() => elements.teamNameSuggestions.style.display = 'none', 200);

    // Recurrencia
    elements.recurringToggle.onchange = openRecurringModal;
    document.getElementById('confirm-recurring-btn').onclick = saveRecurringSettings;
    document.getElementById('cancel-recurring-btn').onclick = () => { elements.recurringToggle.checked = false; closeModals(); };
    document.querySelectorAll('.day-toggle-btn').forEach(btn => btn.onclick = (e) => selectRecurringDay(btn));

    // Modales de Tipo y Opciones
    document.getElementById('type-btn-court').onclick = () => { const d = elements.typeModal.dataset.date; closeModals(); showBookingModal(d); };
    document.getElementById('type-btn-event').onclick = () => { const d = elements.typeModal.dataset.date; closeModals(); showEventModal(d); };
    document.getElementById('type-btn-cancel').onclick = closeModals;
    document.getElementById('add-new-booking-btn').onclick = () => { const d = elements.optionsModal.dataset.date; closeModals(); showBookingModal(d); };
    document.getElementById('close-options-btn').onclick = closeModals;

    // Inventario y Buffet
    document.getElementById('add-product-btn').onclick = () => elements.productFormContainer.classList.toggle('is-hidden');
    document.getElementById('cancel-product-btn').onclick = () => elements.productFormContainer.classList.add('is-hidden');
    elements.productForm.onsubmit = handleSaveProduct;
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        document.getElementById(id).oninput = calculateProductPrices;
    });

    // Venta Buffet
    document.getElementById('header-sale-btn').onclick = openSaleModal;
    elements.saleSearchInput.oninput = handleSaleSearch;
    document.getElementById('sale-qty-minus').onclick = () => updateSaleQty(-1);
    document.getElementById('sale-qty-plus').onclick = () => updateSaleQty(1);
    elements.confirmSaleBtn.onclick = handleConfirmSale;
    document.getElementById('close-sale-modal-btn').onclick = closeModals;

    // Caja y Filtros
    document.getElementById('caja-filter-btn').onclick = loadCajaData;
    document.getElementById('config-form').onsubmit = handleSaveConfig;

    // Cierre de modales al hacer click afuera
    [elements.typeModal, elements.bookingModal, elements.eventModal, elements.optionsModal, elements.viewModal, elements.cajaDetailModal, elements.deleteReasonModal, elements.recurringModal, elements.saleModal].forEach(modal => {
        if(modal) modal.onclick = (e) => { if (e.target === modal) closeModals(); };
    });
}

// -----------------------------------------------------------------
// 3. FUNCIONES DE VISTA Y NAVEGACIÓN
// -----------------------------------------------------------------

function toggleMenu() {
    document.getElementById('main-menu').classList.toggle('is-open');
    document.getElementById('menu-overlay').classList.toggle('hidden');
}

function showView(viewName) {
    for (const key in elements.views) elements.views[key].classList.add('is-hidden');
    if (elements.views[viewName]) {
        elements.views[viewName].classList.remove('is-hidden');
        if (viewName === 'caja') loadCajaData();
        if (viewName === 'productos') syncProducts();
        if (viewName === 'configuracion') loadConfigIntoForm();
        if (viewName === 'stats') loadStats();
        if (viewName === 'historial') loadHistorial();
    }
}

// -----------------------------------------------------------------
// 4. LÓGICA DE CALENDARIO Y RESERVAS
// -----------------------------------------------------------------

async function loadBookingsForMonth() {
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
    
    // Días mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
        const cell = createDayCell(prevMonthLastDay - firstDay + 1 + i, false);
        elements.calendarGrid.appendChild(cell);
    }
    
    // Días mes actual
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
        const cell = createDayCell(i, true, dayBookings, dateStr);
        elements.calendarGrid.appendChild(cell);
    }
}

function createDayCell(dayNum, isCurrent, dayBookings = [], dateStr = '') {
    const cell = document.createElement('div');
    cell.className = `day-cell relative p-2 bg-white ${!isCurrent ? 'other-month-day' : 'cursor-pointer'}`;
    
    if (isCurrent) {
        cell.innerHTML = `<span class="font-bold text-gray-700">${dayNum}</span>`;
        if (dayBookings.length > 0) {
            const hasEvent = dayBookings.some(b => b.type === 'event');
            if (hasEvent) {
                cell.classList.add('bg-amber-50', 'border-amber-200');
                cell.innerHTML += `<span class="booking-count !bg-amber-500">E</span>`;
            } else {
                cell.innerHTML += `<span class="booking-count">${dayBookings.length}</span>`;
            }
        }
        cell.onclick = () => handleDayClick(dateStr);
    } else {
        cell.innerHTML = `<span class="text-gray-300">${dayNum}</span>`;
    }
    return cell;
}

function handleDayClick(dateStr) {
    const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
    if (dayBookings.length === 0) {
        elements.typeModal.dataset.date = dateStr;
        elements.typeModal.classList.add('is-open');
    } else {
        showOptionsModal(dateStr, dayBookings);
    }
}

// -----------------------------------------------------------------
// 5. MODALES DE RESERVA (CANCHA / EVENTO)
// -----------------------------------------------------------------

function showBookingModal(dateStr, booking = null) {
    closeModals();
    elements.bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    document.getElementById('booking-id').value = booking ? booking.id : '';
    document.getElementById('booking-modal-title').textContent = booking ? "Editar Reserva" : `Nuevo Turno (${dateStr})`;
    
    // Resetear Recurrencia
    elements.recurringToggle.checked = false;
    elements.recurringToggle.disabled = booking ? true : false; // No editar recurrencia
    elements.recurringSummary.classList.add('is-hidden');
    recurringSettings = { dayOfWeek: null, months: [] };

    updateCourtAvailability();
    elements.bookingModal.classList.add('is-open');
}

function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const bookingId = document.getElementById('booking-id').value;
    
    // Asignar precio de configuración
    document.getElementById('costPerHour').value = courtId === 'cancha1' ? appSettings.court1Price : appSettings.court2Price;
    document.getElementById('grillCost').value = appSettings.grillPrice;

    // Horas ocupadas por OTROS
    const occupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.courtId === courtId && b.id !== bookingId)
                    .forEach(b => b.courtHours?.forEach(h => occupied.add(h)));

    renderTimeSlots(elements.courtHoursList, occupied);
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
            btn.onclick = () => { 
                btn.classList.toggle('selected'); 
                updateTotalPrice(); 
            };
        }
        container.appendChild(btn);
    });
    
    // Si estamos en parrilla, también renderizar
    if (container === elements.grillHoursList) {
        // Lógica similar para parrilla si fuera compartida, pero por ahora es libre
    }
}

// La misma lógica para el modal de Eventos (simplificado)
function showEventModal(dateStr, booking = null) {
    // ... similar a booking modal pero con campos de evento
    showMessage("Módulo de eventos cargando...", false);
    setTimeout(hideMessage, 1000);
}

// -----------------------------------------------------------------
// 6. LÓGICA DE RECURRENCIA (SÚPER INTEGRAL)
// -----------------------------------------------------------------

function openRecurringModal() {
    if (!elements.recurringToggle.checked) return;
    
    const monthList = document.getElementById('recurring-month-list');
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
        btn.onclick = () => btn.classList.toggle('selected');
        monthList.appendChild(btn);
    }
    
    elements.recurringModal.classList.add('is-open');
}

function selectRecurringDay(btn) {
    document.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
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
        year: parseInt(b.dataset.year),
        label: b.textContent
    }));

    elements.recurringSummary.textContent = `Repetir cada ${WEEKDAYS_ES[recurringSettings.dayOfWeek]} de: ${recurringSettings.months.map(m => m.label).join(', ')}`;
    elements.recurringSummary.classList.remove('is-hidden');
    elements.recurringModal.classList.remove('is-open');
}

// -----------------------------------------------------------------
// 7. GUARDADO EN BASE DE DATOS (BATCH / SINGLE)
// -----------------------------------------------------------------

async function handleSaveBooking(e) {
    e.preventDefault();
    const saveBtn = e.target.querySelector('button[type="submit"]');
    saveBtn.disabled = true;

    if (elements.recurringToggle.checked) {
        return handleSaveRecurringBooking(saveBtn);
    }

    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    if (selectedHours.length === 0) {
        saveBtn.disabled = false;
        return alert("Seleccioná al menos un horario.");
    }

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    
    const data = {
        teamName: elements.teamNameInput.value.trim(),
        courtId: document.querySelector('input[name="courtSelection"]:checked').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value),
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        courtHours: selectedHours,
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
        showMessage("¡Reserva guardada!", false);
        closeModals();
        setTimeout(hideMessage, 1500);
    } catch (error) {
        alert("Error al guardar: " + error.message);
    } finally {
        saveBtn.disabled = false;
    }
}

async function handleSaveRecurringBooking(saveBtn) {
    showMessage("Generando reservas masivas y comprobando disponibilidad...");
    
    const teamName = elements.teamNameInput.value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    
    const commonData = {
        teamName: teamName,
        courtId: courtId,
        costPerHour: parseFloat(document.getElementById('costPerHour').value),
        courtHours: selectedHours,
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        totalPrice: updateTotalPrice(),
        type: 'court',
        createdBy: userId
    };

    // 1. Obtener TODOS los turnos existentes para esta cancha (para evitar choques)
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("courtId", "==", courtId));
    const snap = await getDocs(q);
    const existingSlots = new Map(); // Fecha -> Set de Horas
    snap.forEach(d => {
        const b = d.data();
        if (!existingSlots.has(b.day)) existingSlots.set(b.day, new Set());
        b.courtHours?.forEach(h => existingSlots.get(b.day).add(h));
    });

    const batch = writeBatch(db);
    let createdCount = 0;
    let conflictDates = [];

    // 2. Generar fechas y validar
    recurringSettings.months.forEach(m => {
        const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(m.year, m.month, i);
            if (date.getDay() === recurringSettings.dayOfWeek) {
                const dateStr = `${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                
                // Verificar choque
                const dayOccupied = existingSlots.get(dateStr) || new Set();
                const hasConflict = selectedHours.some(h => dayOccupied.has(h));
                
                if (hasConflict) {
                    conflictDates.push(dateStr);
                } else {
                    const ref = doc(collection(db, COLLECTIONS.BOOKINGS));
                    batch.set(ref, { 
                        ...commonData, 
                        day: dateStr, 
                        monthYear: dateStr.substring(0, 7), 
                        timestamp: Timestamp.now() 
                    });
                    createdCount++;
                }
            }
        }
    });

    if (createdCount > 0) {
        await batch.commit();
        await saveCustomer(teamName);
        let msg = `Se crearon ${createdCount} reservas.`;
        if (conflictDates.length > 0) msg += ` Omitidas ${conflictDates.length} por choques de horario.`;
        showMessage(msg, conflictDates.length > 0);
    } else {
        showMessage("No se pudo crear ninguna reserva. Verificá los horarios.", true);
    }

    saveBtn.disabled = false;
    setTimeout(() => { closeModals(); hideMessage(); }, 3000);
}

// -----------------------------------------------------------------
// 8. BUFFET: INVENTARIO Y PRODUCTOS
// -----------------------------------------------------------------

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct').value) || 0;
    
    const unitCost = cost / qty;
    const finalPrice = unitCost * (1 + (profit / 100));
    
    document.getElementById('prod-unit-cost').value = `$${unitCost.toFixed(2)}`;
    document.getElementById('prod-suggested-price').value = `$${Math.ceil(finalPrice)}`;
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('prod-name').value.trim(),
        stock: parseInt(document.getElementById('prod-stock').value),
        unitCost: parseFloat(document.getElementById('prod-unit-cost').value.replace('$', '')),
        salePrice: parseFloat(document.getElementById('prod-suggested-price').value.replace('$', '')),
        updatedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, COLLECTIONS.PRODUCTS), data);
        elements.productForm.reset();
        elements.productFormContainer.classList.add('is-hidden');
        showMessage("Producto cargado correctamente.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    });
}

function renderProducts() {
    elements.productList.innerHTML = '';
    allProducts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border';
        card.innerHTML = `
            <div>
                <h4 class="font-black text-gray-800">${p.name}</h4>
                <div class="flex gap-2 items-center mt-1">
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'}">Stock: ${p.stock}</span>
                    <span class="text-emerald-600 font-bold">$${p.salePrice}</span>
                </div>
            </div>
            <div class="flex gap-2">
                <button class="p-2 text-red-400 hover:text-red-600" onclick="window.deleteProduct('${p.id}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        elements.productList.appendChild(card);
    });
}

// -----------------------------------------------------------------
// 9. BUFFET: VENTA RÁPIDA
// -----------------------------------------------------------------

function openSaleModal() {
    elements.saleSearchInput.value = '';
    elements.saleSearchResults.classList.add('hidden');
    elements.selectedProductInfo.classList.add('is-hidden');
    elements.confirmSaleBtn.disabled = true;
    elements.saleModal.classList.add('is-open');
}

function handleSaleSearch() {
    const val = elements.saleSearchInput.value.toLowerCase();
    if (val.length < 2) return elements.saleSearchResults.classList.add('hidden');
    
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(val));
    elements.saleSearchResults.innerHTML = '';
    matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'sale-result-item p-3 hover:bg-emerald-50 cursor-pointer rounded-xl flex justify-between';
        item.innerHTML = `<span>${p.name}</span> <strong>$${p.salePrice}</strong>`;
        item.onclick = () => selectProductForSale(p);
        elements.saleSearchResults.appendChild(item);
    });
    elements.saleSearchResults.classList.remove('hidden');
}

function selectProductForSale(p) {
    currentSelectedProduct = p;
    document.getElementById('sel-prod-name').textContent = p.name;
    document.getElementById('sel-prod-stock').textContent = p.stock;
    document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
    document.getElementById('sale-qty-input').value = 1;
    
    elements.saleSearchResults.classList.add('hidden');
    elements.selectedProductInfo.classList.remove('is-hidden');
    elements.confirmSaleBtn.disabled = p.stock <= 0;
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
        productId: currentSelectedProduct.id,
        productName: currentSelectedProduct.name,
        quantity: qty,
        totalPrice: total,
        day: new Date().toISOString().split('T')[0],
        monthYear: new Date().toISOString().substring(0, 7),
        timestamp: Timestamp.now(),
        type: 'sale'
    };

    try {
        showMessage("Registrando venta...");
        await addDoc(collection(db, COLLECTIONS.SALES), saleData);
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id), {
            stock: currentSelectedProduct.stock - qty
        });
        closeModals();
        showMessage("¡Venta exitosa!", false);
        setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 10. GESTIÓN DE CAJA UNIFICADA
// -----------------------------------------------------------------

async function loadCajaData() {
    const from = document.getElementById('caja-date-from').value;
    const to = document.getElementById('caja-date-to').value;
    if (!from || !to) return;

    showMessage("Consultando caja unificada...");
    
    try {
        // Consultar Reservas
        const qBookings = query(collection(db, COLLECTIONS.BOOKINGS), where("day", ">=", from), where("day", "<=", to));
        const snapBookings = await getDocs(qBookings);
        let totalBookings = 0;
        snapBookings.forEach(d => totalBookings += (d.data().totalPrice || 0));

        // Consultar Ventas Buffet
        const qSales = query(collection(db, COLLECTIONS.SALES), where("day", ">=", from), where("day", "<=", to));
        const snapSales = await getDocs(qSales);
        let totalSales = 0;
        snapSales.forEach(d => totalSales += (d.data().totalPrice || 0));

        document.getElementById('caja-total-bookings').textContent = `$${totalBookings.toLocaleString('es-AR')}`;
        document.getElementById('caja-total-sales').textContent = `$${totalSales.toLocaleString('es-AR')}`;
        document.getElementById('caja-total-combined').textContent = `$${(totalBookings + totalSales).toLocaleString('es-AR')}`;
        
        // Renderizar lista diaria (simplificado)
        elements.cajaDailyList.innerHTML = `<p class="text-center text-gray-400 font-bold p-4 bg-white rounded-2xl">Reporte del ${from} al ${to} generado.</p>`;
        
    } catch (err) { console.error(err); }
    finally { hideMessage(); }
}

// -----------------------------------------------------------------
// 11. CONFIGURACIÓN Y OTROS
// -----------------------------------------------------------------

async function loadAppSettings() {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "prices"));
    if (snap.exists()) appSettings = snap.data();
    else await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), appSettings);
}

function loadConfigIntoForm() {
    document.getElementById('config-court1-price').value = appSettings.court1Price;
    document.getElementById('config-court2-price').value = appSettings.court2Price;
    document.getElementById('config-grill-price').value = appSettings.grillPrice;
    document.getElementById('config-event-price').value = appSettings.eventPrice;
}

async function handleSaveConfig(e) {
    e.preventDefault();
    const newSettings = {
        court1Price: parseFloat(document.getElementById('config-court1-price').value),
        court2Price: parseFloat(document.getElementById('config-court2-price').value),
        grillPrice: parseFloat(document.getElementById('config-grill-price').value),
        eventPrice: parseFloat(document.getElementById('config-event-price').value)
    };
    try {
        await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), newSettings);
        appSettings = newSettings;
        showMessage("Configuración actualizada.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

// -----------------------------------------------------------------
// 12. UTILIDADES
// -----------------------------------------------------------------

async function handleLogin(e) { 
    e.preventDefault(); 
    showMessage("Ingresando...");
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
    } catch(err) { 
        alert("Error de acceso: " + err.message); 
        hideMessage();
    } 
}

async function handleRegister(e) { 
    e.preventDefault(); 
    showMessage("Creando cuenta...");
    try { 
        await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); 
    } catch(err) { 
        alert("Error de registro: " + err.message); 
        hideMessage();
    } 
}

async function saveCustomer(name) {
    if (!name) return;
    try {
        const id = name.trim().toLowerCase();
        await setDoc(doc(db, COLLECTIONS.CUSTOMERS, id), { name: name.trim(), lastUpdate: Timestamp.now() }, { merge: true });
    } catch (err) { console.error(err); }
}

async function handleTeamNameInput() {
    const val = elements.teamNameInput.value.trim().toLowerCase();
    if (val.length < 2) { elements.teamNameSuggestions.style.display = 'none'; return; }
    const q = query(collection(db, COLLECTIONS.CUSTOMERS), where(documentId(), ">=", val), where(documentId(), "<=", val + '\uf8ff'));
    const snap = await getDocs(q);
    elements.teamNameSuggestions.innerHTML = '';
    snap.forEach(d => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = d.data().name;
        item.onclick = () => { elements.teamNameInput.value = item.textContent; elements.teamNameSuggestions.style.display = 'none'; };
        elements.teamNameSuggestions.appendChild(item);
    });
    elements.teamNameSuggestions.style.display = 'block';
}

function updateTotalPrice() {
    const isBooking = elements.bookingModal.classList.contains('is-open');
    if (!isBooking) return 0;

    const courtQty = elements.courtHoursList.querySelectorAll('.selected').length;
    const courtPrice = parseFloat(document.getElementById('costPerHour').value) || 0;
    
    let total = courtQty * courtPrice;

    if (document.getElementById('rentGrill').checked) {
        const grillQty = elements.grillHoursList.querySelectorAll('.selected').length;
        const grillPrice = parseFloat(document.getElementById('grillCost').value) || 0;
        total += (grillQty * grillPrice);
    }

    elements.bookingTotal.textContent = `$${total.toLocaleString('es-AR')}`;
    return total;
}

function showOptionsModal(dateStr, dayBookings) {
    elements.optionsModal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    list.innerHTML = '';
    dayBookings.forEach(b => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-50 rounded-xl border flex justify-between items-center';
        item.innerHTML = `
            <div>
                <span class="font-bold text-gray-700">${b.teamName}</span>
                <p class="text-xs text-gray-400">${b.courtId || 'Evento'}</p>
            </div>
            <div class="flex gap-2">
                <button class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg" onclick="window.viewDetails('${b.id}')">VER</button>
                <button class="text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg" onclick="window.deleteBooking('${b.id}')">BORRAR</button>
            </div>
        `;
        list.appendChild(item);
    });
    elements.optionsModal.classList.add('is-open');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
}

function showMessage(msg, isError = false) {
    document.getElementById('message-text').textContent = msg;
    elements.messageOverlay.classList.add('is-open');
}
function hideMessage() { elements.messageOverlay.classList.remove('is-open'); }

// Funciones globales para botones dinámicos
window.deleteProduct = async (id) => { if (confirm("¿Eliminar producto?")) await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id)); };
window.deleteBooking = async (id) => { if (confirm("¿Eliminar reserva?")) await deleteDoc(doc(db, COLLECTIONS.BOOKINGS, id)); closeModals(); };
window.viewDetails = async (id) => {
    const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    if (snap.exists()) {
        const b = snap.data();
        document.getElementById('view-booking-details').innerHTML = `
            <h4 class="text-xl font-black text-emerald-700 mb-2">${b.teamName}</h4>
            <p><strong>Cancha:</strong> ${b.courtId}</p>
            <p><strong>Horas:</strong> ${b.courtHours?.join(', ')}:00hs</p>
            <p><strong>Total:</strong> $${b.totalPrice?.toLocaleString()}</p>
            <p><strong>Pago:</strong> ${b.paymentMethod}</p>
        `;
        elements.viewModal.classList.add('is-open');
    }
};
