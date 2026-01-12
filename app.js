/**
 * APP.JS - SISTEMA DE GESTIÓN INTEGRAL "PANZA VERDE"
 * Incluye: Seguridad, Reservas, Recurrencia, Inventario, Ventas y Caja.
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

// 2. CONFIGURACIÓN E INICIALIZACIÓN
const firebaseConfig = {
    apiKey: "AIzaSyC2dY3i0LqcfmUx4Qx91Cgs66-a-dXSLbk",
    authDomain: "reserva-futsal.firebaseapp.com",
    projectId: "reserva-futsal",
    storageBucket: "reserva-futsal.firebasestorage.app",
    messagingSenderId: "285845706235",
    appId: "1:285845706235:web:9355804aea8181b030275e"
};

// Inicialización inmediata para evitar errores de referencia
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 3. CONSTANTES Y VARIABLES DE ESTADO
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

let userId = null;
let userEmail = null;
let currentMonthDate = new Date();
let allMonthBookings = [];
let allProducts = []; 
let currentSelectedProduct = null;
let currentBookingsUnsubscribe = null;

// Precios cargados desde configuración
let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

// Datos para la lógica de recurrencia
let recurringSettings = {
    dayOfWeek: null,
    months: []
};

// 4. REFERENCIAS AL DOM (ELEMENTOS DE LA INTERFAZ)
const elements = {
    // Vistas principales
    appContainer: document.getElementById('app-container'),
    loginView: document.getElementById('login-view'),
    registerView: document.getElementById('register-view'),
    
    // Calendario
    calendarGrid: document.getElementById('calendar-grid'),
    currentMonthYear: document.getElementById('current-month-year'),
    
    // Formularios de Reserva
    bookingForm: document.getElementById('booking-form'),
    teamNameInput: document.getElementById('teamName'),
    teamNameSuggestions: document.getElementById('teamName-suggestions'),
    courtHoursList: document.getElementById('court-hours-list'),
    grillHoursList: document.getElementById('grill-hours-list'),
    bookingTotal: document.getElementById('booking-total'),
    recurringToggle: document.getElementById('recurring-toggle'),
    recurringSummary: document.getElementById('recurring-summary'),

    // Inventario y Buffet
    productForm: document.getElementById('product-form'),
    productList: document.getElementById('product-list'),
    inventorySearch: document.getElementById('inventory-search-input'),
    restockModal: document.getElementById('restock-modal'),
    historyModal: document.getElementById('product-history-modal'),
    editProductModal: document.getElementById('edit-product-modal'),

    // Venta Rápida
    saleModal: document.getElementById('sale-modal'),
    saleSearchInput: document.getElementById('sale-search-input'),
    saleSearchResults: document.getElementById('sale-search-results'),
    selectedProductInfo: document.getElementById('selected-product-info'),
    confirmSaleBtn: document.getElementById('confirm-sale-btn'),
    
    // Mensajes y Overlays
    messageOverlay: document.getElementById('message-overlay'),
    messageText: document.getElementById('message-text')
};

// -----------------------------------------------------------------
// 5. INICIO DE LA APLICACIÓN Y AUTENTICACIÓN
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Sistema Panza Verde v4.0 - Iniciando...");
    setupEventListeners();
    
    // Configurar persistencia para que el usuario no tenga que loguearse siempre
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
        console.error("Error de persistencia:", error);
    }
    
    // Observador de estado de usuario
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Sesión activa:", user.email);
            userId = user.uid;
            userEmail = user.email;
            document.getElementById('user-email-display').textContent = userEmail;
            
            // Cargar datos vitales
            await loadAppSettings();
            
            // Mostrar App
            elements.appContainer.classList.remove('is-hidden');
            elements.loginView.classList.add('is-hidden');
            elements.registerView.classList.add('is-hidden');
            
            // Iniciar sincronización de datos
            loadBookingsForMonth();
            syncProducts(); 
        } else {
            console.log("No hay usuario autenticado.");
            elements.appContainer.classList.add('is-hidden');
            elements.loginView.classList.remove('is-hidden');
        }
    });

    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            reg.update();
        });
    }
});

// -----------------------------------------------------------------
// 6. ASIGNACIÓN DE EVENTOS (LISTENERS)
// -----------------------------------------------------------------

function setupEventListeners() {
    // Menú Hamburguesa y Navegación
    document.getElementById('menu-btn').onclick = toggleMenu;
    document.getElementById('menu-overlay').onclick = toggleMenu;
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            const targetView = e.target.dataset.view || e.target.closest('.menu-item').dataset.view;
            showView(targetView);
            toggleMenu();
        };
    });

    // Formulario de Login y Registro
    document.getElementById('login-form').onsubmit = handleLogin;
    document.getElementById('register-form').onsubmit = handleRegister;
    document.getElementById('logout-btn').onclick = () => signOut(auth);
    
    // Cambiar entre Login y Registro
    document.getElementById('show-register').onclick = (e) => {
        e.preventDefault();
        elements.loginView.classList.add('is-hidden');
        elements.registerView.classList.remove('is-hidden');
    };
    document.getElementById('show-login').onclick = (e) => {
        e.preventDefault();
        elements.registerView.classList.add('is-hidden');
        elements.loginView.classList.remove('is-hidden');
    };

    // Navegación de Meses en Calendario
    document.getElementById('prev-month-btn').onclick = () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        loadBookingsForMonth();
    };
    document.getElementById('next-month-btn').onclick = () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        loadBookingsForMonth();
    };

    // Lógica de Formulario de Reservas
    elements.bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => {
        radio.onchange = updateCourtAvailability;
    });
    document.getElementById('rentGrill').onchange = (e) => {
        document.getElementById('grill-hours-section').classList.toggle('is-hidden', !e.target.checked);
        updateTotalPrice();
    };
    document.getElementById('costPerHour').oninput = updateTotalPrice;
    document.getElementById('grillCost').oninput = updateTotalPrice;
    elements.teamNameInput.oninput = handleTeamNameInput;

    // Lógica de Recurrencia
    elements.recurringToggle.onchange = openRecurringModal;
    document.getElementById('confirm-recurring-btn').onclick = saveRecurringSettings;
    document.getElementById('cancel-recurring-btn').onclick = () => {
        elements.recurringToggle.checked = false;
        closeModals();
    };
    document.querySelectorAll('.day-toggle-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
    });

    // Gestión de Inventario / Buffet
    document.getElementById('add-product-btn').onclick = () => {
        document.getElementById('product-form-container').classList.toggle('is-hidden');
    };
    document.getElementById('cancel-product-btn').onclick = () => {
        document.getElementById('product-form-container').classList.add('is-hidden');
    };
    elements.productForm.onsubmit = handleSaveProduct;
    elements.inventorySearch.oninput = () => renderProducts(elements.inventorySearch.value);
    
    // Cálculo de precios sugeridos al cargar producto
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        document.getElementById(id).oninput = calculateProductPrices;
    });

    // Lógica de Modales de Reposición y Edición
    document.getElementById('restock-form').onsubmit = handleConfirmRestock;
    document.getElementById('edit-product-form').onsubmit = handleConfirmEditProduct;

    // Venta Rápida Buffet
    document.getElementById('header-sale-btn').onclick = openSaleModal;
    elements.saleSearchInput.oninput = handleSaleSearch;
    document.getElementById('sale-qty-minus').onclick = () => updateSaleQty(-1);
    document.getElementById('sale-qty-plus').onclick = () => updateSaleQty(1);
    elements.confirmSaleBtn.onclick = handleConfirmSale;
    document.getElementById('close-sale-modal-btn').onclick = closeModals;

    // Caja y Configuración
    document.getElementById('caja-filter-btn').onclick = loadCajaData;
    document.getElementById('config-form').onsubmit = handleSaveConfig;

    // Listener para cerrar modales al hacer clic fuera (Overlay)
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            closeModals();
        }
    };
}

// -----------------------------------------------------------------
// 7. LÓGICA DE NAVEGACIÓN Y VISTAS
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
    
    const target = document.getElementById(viewName + '-view');
    if (target) {
        target.classList.remove('is-hidden');
    }
    
    // Cargas específicas por vista
    if (viewName === 'configuracion') loadConfigIntoForm();
    if (viewName === 'caja') loadCajaData();
}

// -----------------------------------------------------------------
// 8. LÓGICA DE RESERVAS Y CALENDARIO
// -----------------------------------------------------------------

/**
 * Carga las reservas del mes actual desde Firestore
 */
function loadBookingsForMonth() {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth() + 1;
    const monthYear = `${year}-${String(month).padStart(2, '0')}`;
    
    elements.currentMonthYear.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(currentMonthDate);
    
    // Detener suscripción anterior si existe
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe();
    
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("monthYear", "==", monthYear));
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

/**
 * Dibuja la cuadrícula del calendario
 */
function renderCalendar() {
    elements.calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Días de relleno (mes anterior)
    for (let i = 0; i < firstDay; i++) {
        elements.calendarGrid.appendChild(createCell('', false));
    }
    
    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayBookings = allMonthBookings.filter(b => b.day === dateStr);
        elements.calendarGrid.appendChild(createCell(i, true, dayBookings, dateStr));
    }
}

/**
 * Crea el elemento visual de cada día
 */
function createCell(num, isCurrent, dayBookings = [], dateStr = '') {
    const cell = document.createElement('div');
    cell.className = `day-cell p-2 ${!isCurrent ? 'other-month-day opacity-20' : 'cursor-pointer'}`;
    
    if (isCurrent) {
        cell.innerHTML = `<span class="font-black text-gray-700 text-sm md:text-base">${num}</span>`;
        if (dayBookings.length > 0) {
            cell.innerHTML += `<span class="booking-count">${dayBookings.length}</span>`;
        }
        cell.onclick = () => {
            if (dayBookings.length === 0) {
                const modal = document.getElementById('type-modal');
                modal.dataset.date = dateStr;
                modal.classList.add('is-open');
            } else {
                showOptionsModal(dateStr, dayBookings);
            }
        };
    }
    return cell;
}

/**
 * Abre el modal para crear una reserva simple
 */
function showBookingModal(dateStr, booking = null) {
    closeModals();
    elements.bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    document.getElementById('booking-id').value = booking ? booking.id : '';
    document.getElementById('booking-modal-title').textContent = booking ? "Editar Reserva" : `Nuevo Turno (${dateStr})`;
    
    // Resetear visualmente la recurrencia
    elements.recurringToggle.checked = false;
    elements.recurringSummary.classList.add('is-hidden');
    recurringSettings = { dayOfWeek: null, months: [] };

    updateCourtAvailability();
    document.getElementById('booking-modal').classList.add('is-open');
}

/**
 * Verifica horarios ocupados para bloquear botones en el modal
 */
function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const bookingId = document.getElementById('booking-id').value;
    
    // Asignar precios configurados
    document.getElementById('costPerHour').value = (courtId === 'cancha1') ? appSettings.court1Price : appSettings.court2Price;
    document.getElementById('grillCost').value = appSettings.grillPrice;

    // Horas ocupadas de cancha
    const occupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.courtId === courtId && b.id !== bookingId)
                    .forEach(b => b.courtHours?.forEach(h => occupied.add(h)));
    renderTimeSlots(elements.courtHoursList, occupied);
    
    // Horas ocupadas de parrilla
    const grillOccupied = new Set();
    allMonthBookings.filter(b => b.day === dateStr && b.rentGrill && b.id !== bookingId)
                    .forEach(b => b.grillHours?.forEach(h => grillOccupied.add(h)));
    renderTimeSlots(document.getElementById('grill-hours-list'), grillOccupied);

    updateTotalPrice();
}

/**
 * Dibuja los botones de 09:00 a 23:00
 */
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
}

/**
 * Calcula el total del turno (Cancha + Parrilla)
 */
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
// 9. LÓGICA DE RECURRENCIA (SISTEMA MASIVO)
// -----------------------------------------------------------------

/**
 * Abre el modal para elegir días y meses de repetición
 */
function openRecurringModal() {
    if (!document.getElementById('recurring-toggle').checked) return;
    
    const list = document.getElementById('recurring-month-list');
    list.innerHTML = '';
    
    // Ofrecer los próximos 12 meses
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
        list.appendChild(btn);
    }
    document.getElementById('recurring-modal').classList.add('is-open');
}

/**
 * Guarda los ajustes de repetición en memoria antes de confirmar la reserva
 */
function saveRecurringSettings() {
    const dayBtn = document.querySelector('.day-toggle-btn.selected');
    const monthBtns = document.querySelectorAll('.month-toggle-btn.selected');
    
    if (!dayBtn || monthBtns.length === 0) {
        return alert("Seleccioná un día de la semana y al menos un mes.");
    }

    recurringSettings.dayOfWeek = parseInt(dayBtn.dataset.day);
    recurringSettings.months = Array.from(monthBtns).map(b => ({
        month: parseInt(b.dataset.month),
        year: parseInt(b.dataset.year)
    }));

    document.getElementById('recurring-summary').textContent = `Repetir todos los ${WEEKDAYS[recurringSettings.dayOfWeek]}`;
    document.getElementById('recurring-summary').classList.remove('is-hidden');
    document.getElementById('recurring-modal').classList.remove('is-open');
}

// -----------------------------------------------------------------
// 10. GUARDADO DE RESERVAS (SIMPLE Y MASIVO)
// -----------------------------------------------------------------

/**
 * Maneja el envío del formulario de reservas
 */
async function handleSaveBooking(e) {
    e.preventDefault();
    const saveBtn = e.target.querySelector('button[type="submit"]');
    saveBtn.disabled = true;

    // Si es recurrente, derivamos a la lógica masiva
    if (document.getElementById('recurring-toggle').checked) {
        return handleSaveRecurringBooking(saveBtn);
    }

    // Validación de horario
    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    if (selectedHours.length === 0) {
        saveBtn.disabled = false;
        return alert("Elegí al menos un horario de cancha.");
    }

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
        if (bookingId) {
            await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), data);
        } else {
            await addDoc(collection(db, COLLECTIONS.BOOKINGS), data);
        }
        
        await saveCustomer(data.teamName);
        closeModals();
        showMessage("Reserva guardada con éxito.");
        setTimeout(hideMessage, 1500);
    } catch (err) {
        alert("Error al guardar en la nube: " + err.message);
    } finally {
        saveBtn.disabled = false;
    }
}

/**
 * Lógica compleja para generar múltiples reservas verificando choques
 */
async function handleSaveRecurringBooking(btn) {
    showMessage("Comprobando disponibilidad y generando reservas...");
    
    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedHours = Array.from(elements.courtHoursList.querySelectorAll('.selected')).map(b => parseInt(b.textContent));
    
    // 1. Obtener TODOS los turnos para esta cancha para evitar superposiciones
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where("courtId", "==", courtId));
    const snap = await getDocs(q);
    const occupied = new Map();
    snap.forEach(d => {
        const b = d.data();
        if (!occupied.has(b.day)) occupied.set(b.day, new Set());
        b.courtHours?.forEach(h => occupied.get(b.day).add(h));
    });

    const batch = writeBatch(db);
    let count = 0, errors = 0;

    // 2. Iterar por los meses seleccionados
    recurringSettings.months.forEach(m => {
        const lastDay = new Date(m.year, m.month + 1, 0).getDate();
        for (let i = 1; i <= lastDay; i++) {
            const d = new Date(m.year, m.month, i);
            if (d.getDay() === recurringSettings.dayOfWeek) {
                const dateStr = `${m.year}-${String(m.month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                
                // Verificar si hay choque de horario ese día
                const dayOccupied = occupied.get(dateStr) || new Set();
                const hasConflict = selectedHours.some(h => dayOccupied.has(h));
                
                if (hasConflict) {
                    errors++;
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
                    count++;
                }
            }
        }
    });

    // 3. Ejecutar guardado masivo
    try {
        await batch.commit();
        await saveCustomer(teamName);
        showMessage(`¡Listo! Se crearon ${count} reservas. (Omitidas por choque: ${errors})`);
    } catch (err) {
        alert("Error en proceso masivo: " + err.message);
    } finally {
        btn.disabled = false;
        setTimeout(() => { closeModals(); hideMessage(); }, 3000);
    }
}

// -----------------------------------------------------------------
// 11. GESTIÓN DE BUFFET: PRODUCTOS Y COSTO REPOSICIÓN
// -----------------------------------------------------------------

/**
 * Calcula precios sugeridos mientras el usuario escribe
 */
function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct').value) || 0;
    
    const unitCost = cost / qty;
    const salePrice = Math.ceil(unitCost * (1 + (profit / 100)));
    
    document.getElementById('prod-suggested-price').textContent = `$${salePrice}`;
    document.getElementById('prod-unit-cost').value = unitCost;
}

/**
 * Guarda un producto nuevo por primera vez
 */
async function handleSaveProduct(e) {
    e.preventDefault();
    const unitCost = parseFloat(document.getElementById('prod-unit-cost').value);
    const salePrice = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));
    const name = document.getElementById('prod-name').value.trim();
    const stock = parseInt(document.getElementById('prod-stock').value);

    const data = {
        name,
        stock,
        unitCost,
        salePrice,
        createdAt: Timestamp.now()
    };

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), data);
        await logTransaction(docRef.id, 'Alta Inicial', stock, unitCost, 'in');
        
        elements.productForm.reset();
        document.getElementById('product-form-container').classList.add('is-hidden');
        showMessage("Producto agregado al inventario.");
        setTimeout(hideMessage, 1500);
    } catch (err) {
        alert("Permisos insuficientes o error: " + err.message);
    }
}

/**
 * Sincroniza la lista de productos en tiempo real
 */
function syncProducts() {
    onSnapshot(collection(db, COLLECTIONS.PRODUCTS), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(elements.inventorySearch.value);
    });
}

/**
 * Dibuja las tarjetas de productos con sus acciones
 */
function renderProducts(filter = "") {
    elements.productList.innerHTML = '';
    const filtered = allProducts.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'}">Stock: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-gray-400 uppercase">P. Venta</p>
                    <p class="text-2xl font-black text-emerald-600">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2">
                <button class="card-action-btn bg-blue-50 text-blue-700" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn bg-gray-50 text-gray-700" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn bg-gray-50 text-gray-700" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn bg-red-50 text-red-600" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
            </div>
        `;
        elements.productList.appendChild(div);
    });
}

// -----------------------------------------------------------------
// 12. LÓGICA DE REPOSICIÓN DIRECTA Y HISTORIAL
// -----------------------------------------------------------------

/**
 * Lógica de Reposición Directa: Actualiza todo el stock al precio de la nueva compra
 */
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    // Nuevo costo por unidad del lote entrante
    const newUnitCost = batchCost / addQty;
    
    // Buscamos el producto actual
    const p = allProducts.find(x => x.id === id);
    const newTotalStock = p.stock + addQty;

    // Calculamos nuevo precio de venta manteniendo el margen anterior automáticamente
    const profitFactor = p.salePrice / p.unitCost; 
    const newSalePrice = Math.ceil(newUnitCost * profitFactor);

    try {
        showMessage("Actualizando costos de todo el stock...");
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
            stock: newTotalStock,
            unitCost: newUnitCost, // Reposición directa: todo vale el nuevo costo
            salePrice: newSalePrice
        });
        
        // Registrar en historial
        await logTransaction(id, `Reposición Directa (+${addQty})`, addQty, newUnitCost, 'in');
        
        closeModals();
        showMessage(`Stock actualizado. Todo el stock ahora tiene un costo de $${newUnitCost.toFixed(2)}/u.`);
        setTimeout(hideMessage, 3000);
    } catch (err) {
        alert(err.message);
    }
}

/**
 * Registra un movimiento en la colección de transacciones
 */
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

/**
 * Abre el historial visual de un producto
 */
window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const list = document.getElementById('product-history-list');
    list.innerHTML = '<p class="text-center p-4">Consultando historial...</p>';
    
    const q = query(collection(db, COLLECTIONS.TRANSACTIONS), where("productId", "==", id), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    
    list.innerHTML = snap.empty ? '<p class="text-center text-gray-400 py-4">Sin movimientos registrados.</p>' : '';
    
    snap.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const item = document.createElement('div');
        item.className = `history-item history-type-${t.type}`;
        item.innerHTML = `
            <div>
                <p class="font-black text-gray-800 text-sm">${t.desc}</p>
                <p class="text-[10px] text-gray-400 font-bold uppercase">${date}</p>
            </div>
            <div class="text-right">
                <p class="font-black ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}">
                    ${t.type === 'in' ? '+' : '-'}${t.qty}
                </p>
                <p class="text-[9px] font-bold text-gray-300">COSTO: $${t.cost?.toFixed(2)}</p>
            </div>
        `;
        list.appendChild(item);
    });
    elements.historyModal.classList.add('is-open');
};

// -----------------------------------------------------------------
// 13. VENTA RÁPIDA (BUFFET)
// -----------------------------------------------------------------

function openSaleModal() {
    elements.saleSearchInput.value = '';
    elements.saleSearchResults.innerHTML = '';
    elements.selectedProductInfo.classList.add('is-hidden');
    elements.confirmSaleBtn.disabled = true;
    elements.saleModal.classList.add('is-open');
    elements.saleSearchInput.focus();
}

function handleSaleSearch() {
    const val = elements.saleSearchInput.value.toLowerCase();
    if (val.length < 2) {
        elements.saleSearchResults.innerHTML = '';
        return;
    }
    
    const matches = allProducts.filter(p => p.name.toLowerCase().includes(val));
    elements.saleSearchResults.innerHTML = '';
    
    matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200';
        item.innerHTML = `
            <div>
                <span class="font-black text-gray-800">${p.name}</span>
                <p class="text-[10px] font-bold text-gray-400 uppercase">STOCK: ${p.stock}</p>
            </div>
            <strong class="text-emerald-600 text-lg">$${p.salePrice}</strong>
        `;
        item.onclick = () => {
            currentSelectedProduct = p;
            document.getElementById('sel-prod-name').textContent = p.name;
            document.getElementById('sel-prod-stock').textContent = p.stock;
            document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
            document.getElementById('sale-qty-input').value = 1;
            elements.selectedProductInfo.classList.remove('is-hidden');
            elements.confirmSaleBtn.disabled = p.stock <= 0;
            updateSaleTotal();
        };
        elements.saleSearchResults.appendChild(item);
    });
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
        showMessage("Registrando venta...");
        // 1. Guardar la venta
        await addDoc(collection(db, COLLECTIONS.SALES), {
            name: currentSelectedProduct.name,
            qty,
            total,
            day: new Date().toISOString().split('T')[0],
            monthYear: new Date().toISOString().substring(0, 7),
            timestamp: Timestamp.now()
        });
        
        // 2. Descontar stock
        await updateDoc(doc(db, COLLECTIONS.PRODUCTS, currentSelectedProduct.id), {
            stock: currentSelectedProduct.stock - qty
        });
        
        // 3. Log de movimiento
        await logTransaction(currentSelectedProduct.id, 'Venta Buffet', qty, currentSelectedProduct.unitCost, 'out');
        
        closeModals();
        showMessage("¡Venta cobrada correctamente!");
        setTimeout(hideMessage, 1500);
    } catch (err) {
        alert("Error al cobrar: " + err.message);
    }
}

// -----------------------------------------------------------------
// 14. GESTIÓN DE CAJA UNIFICADA
// -----------------------------------------------------------------

async function loadCajaData() {
    const from = document.getElementById('caja-date-from').value;
    const to = document.getElementById('caja-date-to').value;
    if (!from || !to) return;

    showMessage("Consultando balance unificado...");
    
    try {
        // Consultar Reservas de Canchas
        const qB = query(collection(db, COLLECTIONS.BOOKINGS), where("day", ">=", from), where("day", "<=", to));
        const snapB = await getDocs(qB);
        let totalB = 0;
        snapB.forEach(d => totalB += (d.data().totalPrice || 0));

        // Consultar Ventas Buffet
        const qS = query(collection(db, COLLECTIONS.SALES), where("day", ">=", from), where("day", "<=", to));
        const snapS = await getDocs(qS);
        let totalS = 0;
        snapS.forEach(d => totalS += (d.data().total || 0));

        document.getElementById('caja-total-bookings').textContent = `$${totalB.toLocaleString('es-AR')}`;
        document.getElementById('caja-total-sales').textContent = `$${totalS.toLocaleString('es-AR')}`;
        document.getElementById('caja-total-combined').textContent = `$${(totalB + totalS).toLocaleString('es-AR')}`;
        
        // Generar lista de días resumen (opcional)
        document.getElementById('caja-daily-list').innerHTML = `<p class="text-center font-bold text-gray-400 py-4 bg-white rounded-3xl">Reporte generado del ${from} al ${to}</p>`;
        
    } catch (err) {
        console.error("Error en caja:", err);
    } finally {
        hideMessage();
    }
}

// -----------------------------------------------------------------
// 15. UTILIDADES, AUTH Y MODALES DINÁMICOS
// -----------------------------------------------------------------

async function handleLogin(e) { 
    e.preventDefault(); 
    showMessage("Validando acceso...");
    try { 
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); 
    } catch(err) { 
        alert("Credenciales incorrectas: " + err.message); 
        hideMessage(); 
    } 
}

async function handleRegister(e) { 
    e.preventDefault(); 
    showMessage("Creando cuenta de administrador...");
    try { 
        await createUserWithEmailAndPassword(auth, document.getElementById('register-email').value, document.getElementById('register-password').value); 
    } catch(err) { 
        alert("Error de registro: " + err.message); 
        hideMessage(); 
    } 
}

async function loadAppSettings() {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "prices"));
    if (snap.exists()) {
        appSettings = snap.data();
    } else {
        await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), appSettings);
    }
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
    try {
        await setDoc(doc(db, COLLECTIONS.SETTINGS, "prices"), data);
        appSettings = data;
        showMessage("Precios actualizados en el sistema.");
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
    // Resetear interruptores visuales
    const rt = document.getElementById('recurring-toggle');
    if (rt) rt.checked = false;
}

function showMessage(msg) {
    elements.messageText.textContent = msg;
    elements.messageOverlay.classList.add('is-open');
}

function hideMessage() { 
    elements.messageOverlay.classList.remove('is-open'); 
}

/**
 * Sugerencias de autocompletado para equipos
 */
async function handleTeamNameInput() {
    const val = elements.teamNameInput.value.trim().toLowerCase();
    if (val.length < 2) {
        elements.teamNameSuggestions.style.display = 'none';
        return;
    }
    const q = query(collection(db, COLLECTIONS.CUSTOMERS), where(documentId(), ">=", val), where(documentId(), "<=", val + '\uf8ff'));
    const snap = await getDocs(q);
    elements.teamNameSuggestions.innerHTML = '';
    snap.forEach(d => {
        const item = document.createElement('div');
        item.className = 'p-3 hover:bg-emerald-50 cursor-pointer border-b font-bold text-sm';
        item.textContent = d.data().name;
        item.onmousedown = () => { 
            elements.teamNameInput.value = d.data().name; 
            elements.teamNameSuggestions.style.display = 'none'; 
        };
        elements.teamNameSuggestions.appendChild(item);
    });
    elements.teamNameSuggestions.style.display = snap.empty ? 'none' : 'block';
}

/**
 * Guarda o actualiza el registro de un cliente
 */
async function saveCustomer(name) {
    if (!name) return;
    try { 
        await setDoc(doc(db, COLLECTIONS.CUSTOMERS, name.trim().toLowerCase()), { 
            name: name.trim(), 
            updatedAt: Timestamp.now() 
        }, { merge: true }); 
    } catch (err) {}
}

/**
 * Muestra las reservas de un día específico
 */
function showOptionsModal(dateStr, bookings) {
    const modal = document.getElementById('options-modal');
    modal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    list.innerHTML = '';
    bookings.forEach(b => {
        const div = document.createElement('div');
        div.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between items-center border border-gray-100 mb-2 shadow-sm';
        div.innerHTML = `
            <div>
                <p class="font-black text-gray-800">${b.teamName}</p>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${b.courtId}</p>
            </div>
            <div class="flex gap-2">
                <button class="text-blue-600 font-black text-xs bg-white px-4 py-2 rounded-xl shadow-sm" onclick="window.viewBooking('${b.id}')">VER</button>
                <button class="text-red-500 font-black text-xs bg-white px-4 py-2 rounded-xl shadow-sm" onclick="window.deleteBooking('${b.id}')">BORRAR</button>
            </div>`;
        list.appendChild(div);
    });
    modal.classList.add('is-open');
}

/**
 * Funciones globales para botones creados dinámicamente con innerHTML
 */
window.viewBooking = async (id) => {
    const snap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, id));
    if (snap.exists()) {
        const b = snap.data();
        document.getElementById('view-booking-details').innerHTML = `
            <div class="p-4 bg-emerald-50 rounded-3xl mb-4">
                <h4 class="text-2xl font-black text-emerald-800">${b.teamName}</h4>
            </div>
            <div class="space-y-3 font-bold text-gray-600 px-2">
                <p class="flex justify-between"><span>CANCHA:</span> <span class="text-gray-900">${b.courtId.toUpperCase()}</span></p>
                <p class="flex justify-between"><span>HORARIO:</span> <span class="text-gray-900">${b.courtHours?.join(', ')}hs</span></p>
                <p class="flex justify-between"><span>METODO:</span> <span class="text-gray-900">${b.paymentMethod?.toUpperCase()}</span></p>
                <div class="border-t pt-2 mt-4">
                    <p class="flex justify-between text-xl text-emerald-600 font-black"><span>TOTAL:</span> <span>$${b.totalPrice?.toLocaleString()}</span></p>
                </div>
            </div>`;
        document.getElementById('view-modal').classList.add('is-open');
    }
};

window.deleteBooking = async (id) => {
    if (confirm("¿Realmente deseas borrar este turno del sistema?")) {
        await deleteDoc(doc(db, COLLECTIONS.BOOKINGS, id));
        closeModals();
        showMessage("Turno eliminado.");
        setTimeout(hideMessage, 1000);
    }
};

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    currentSelectedProduct = p;
    document.getElementById('restock-prod-id').value = id;
    document.getElementById('restock-name').textContent = p.name;
    document.getElementById('restock-current-stock').textContent = p.stock;
    elements.restockModal.classList.add('is-open');
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

window.deleteProduct = async (id) => {
    if (confirm("¿Eliminar este producto permanentemente del inventario? Esto no borrará las ventas pasadas de la caja pero sí el producto del buffet.")) {
        await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
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
    showMessage("Producto actualizado.");
    setTimeout(hideMessage, 1000);
}

console.log("Sistema cargado al 100% sin omisiones.");
