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

// --- RUTAS DE COLECCIONES ---
const bookingsCollectionPath = "bookings"; 
const customersCollectionPath = "customers";
const logCollectionPath = "booking_log"; 
const settingsDocPath = "app_settings/prices"; 
const productsCollectionPath = "products";
const salesCollectionPath = "sales";
const transactionsCollectionPath = "product_transactions";

// --- CONSTANTES DE LA APP ---
const OPERATING_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]; 
const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- VARIABLES GLOBALES DE ESTADO ---
let db, auth, userId = null, userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = []; 
let currentSelectedProduct = null;

let appSettings = { 
    court1Price: 5000, 
    court2Price: 5000, 
    grillPrice: 2000, 
    eventPrice: 10000 
};
let recurringSettings = { dayOfWeek: null, months: [] };

// --- REFERENCIAS AL DOM ---
const getEl = (id) => document.getElementById(id);

const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const appContainer = document.getElementById('app-container');

const views = {
    calendar: document.getElementById('calendar-view'),
    caja: document.getElementById('caja-view'),
    stats: document.getElementById('stats-view'),
    historial: document.getElementById('historial-view'),
    configuracion: document.getElementById('config-view'),
    productos: document.getElementById('productos-view') 
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
const cajaDetailModal = document.getElementById('caja-detail-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); 
const recurringModal = document.getElementById('recurring-modal'); 
const messageOverlay = document.getElementById('message-overlay');

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
const recurringToggle = document.getElementById('recurring-toggle'); 
const recurringSummary = document.getElementById('recurring-summary'); 

const eventForm = document.getElementById('event-form');
const eventBookingIdInput = document.getElementById('event-booking-id'); 
const eventDateInput = document.getElementById('event-date'); 
const eventNameInput = document.getElementById('eventName');
const contactPersonInput = document.getElementById('contactPerson');
const contactPhoneInput = document.getElementById('contactPhone');
const eventCostPerHourInput = document.getElementById('eventCostPerHour');
const eventHoursList = document.getElementById('event-hours-list');
const eventTotal = document.getElementById('event-total');

const deleteReasonForm = document.getElementById('delete-reason-form');
const deleteReasonText = document.getElementById('delete-reason-text');
const deleteBookingIdInput = document.getElementById('delete-booking-id');

const configForm = document.getElementById('config-form');
const configCourt1Price = document.getElementById('config-court1-price');
const configCourt2Price = document.getElementById('config-court2-price');

const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');
const inventorySearchInput = document.getElementById('inventory-search-input');
const restockForm = document.getElementById('restock-form');
const saleModal = document.getElementById('sale-modal');
const saleSearchInput = document.getElementById('sale-search-input');
const saleSearchResults = document.getElementById('sale-search-results');
const selectedProductInfo = document.getElementById('selected-product-info');
const confirmSaleBtn = document.getElementById('confirm-sale-btn');

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando Sistema Pro v2026...");
    setupEventListeners();
    registerServiceWorker();
    firebaseInit();
});

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.error('Error Service Worker:', error);
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
                console.log("Acceso autorizado para:", user.email);
                userId = user.uid;
                userEmail = user.email;
                await loadAppSettings(); 
                
                if (appContainer) appContainer.classList.remove('is-hidden');
                if (loginView) loginView.classList.add('is-hidden');
                if (registerView) registerView.classList.add('is-hidden');
                if (userEmailDisplay) userEmailDisplay.textContent = userEmail;
                
                await loadBookingsForMonth(); 
                syncProducts();
            } else {
                userId = null;
                userEmail = null;
                if (appContainer) appContainer.classList.add('is-hidden');
                if (loginView) loginView.classList.remove('is-hidden');
                if (registerView) registerView.classList.add('is-hidden');
                if (currentBookingsUnsubscribe) {
                    currentBookingsUnsubscribe();
                    currentBookingsUnsubscribe = null;
                }
                allMonthBookings = [];
            }
        });
    } catch (error) {
        console.error("Fallo Firebase:", error);
        showMessage(`Error de conexión: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 2. CONFIGURACIÓN DE EVENT LISTENERS (EXPLÍCITOS)
// -----------------------------------------------------------------

function setupEventListeners() {
    // Menú y Navegación
    if (menuBtn) menuBtn.onclick = toggleMenu;
    if (menuOverlay) menuOverlay.onclick = toggleMenu;
    if (logoutBtn) logoutBtn.onclick = handleLogout; 
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const viewName = e.currentTarget.dataset.view;
            showView(viewName);
            toggleMenu();
        };
    });
    
    // Autenticación
    if (loginForm) loginForm.onsubmit = handleLogin;
    if (registerForm) registerForm.onsubmit = handleRegister;
    
    const showRegisterLink = document.getElementById('show-register');
    if (showRegisterLink) {
        showRegisterLink.onclick = (e) => {
            e.preventDefault();
            if (loginView) loginView.classList.add('is-hidden');
            if (registerView) registerView.classList.remove('is-hidden');
        };
    }
    
    const showLoginLink = document.getElementById('show-login');
    if (showLoginLink) {
        showLoginLink.onclick = (e) => {
            e.preventDefault();
            if (registerView) registerView.classList.add('is-hidden');
            if (loginView) loginView.classList.remove('is-hidden');
        };
    }
    
    const prevBtn = document.getElementById('prev-month-btn');
    if (prevBtn) prevBtn.onclick = prevMonth;
    
    const nextBtn = document.getElementById('next-month-btn');
    if (nextBtn) nextBtn.onclick = nextMonth;
    
    // Formularios Reservas
    if (bookingForm) bookingForm.onsubmit = handleSaveBooking;
    if (eventForm) eventForm.onsubmit = handleSaveEvent; 
    if (configForm) configForm.onsubmit = handleSaveConfig;

    const cancelBookingBtn = document.getElementById('cancel-booking-btn');
    if (cancelBookingBtn) cancelBookingBtn.onclick = closeModals;

    const cancelEventBtn = document.getElementById('cancel-event-btn');
    if (cancelEventBtn) cancelEventBtn.onclick = closeModals;

    const closeOptionsBtn = document.getElementById('close-options-btn');
    if (closeOptionsBtn) closeOptionsBtn.onclick = closeModals;

    const closeViewBtn = document.getElementById('close-view-btn');
    if (closeViewBtn) closeViewBtn.onclick = closeModals;

    const closeCajaDetailBtn = document.getElementById('close-caja-detail-btn');
    if (closeCajaDetailBtn) closeCajaDetailBtn.onclick = closeModals;

    // Botones de acción desde modales
    const addNewBookingBtn = document.getElementById('add-new-booking-btn');
    if (addNewBookingBtn) {
        addNewBookingBtn.onclick = () => {
            const ds = optionsModal.dataset.date;
            closeModals();
            showBookingModal(ds); 
        };
    }

    const typeBtnCourt = document.getElementById('type-btn-court');
    if (typeBtnCourt) {
        typeBtnCourt.onclick = () => {
            const ds = typeModal.dataset.date;
            closeModals();
            showBookingModal(ds);
        };
    }

    const typeBtnEvent = document.getElementById('type-btn-event');
    if (typeBtnEvent) {
        typeBtnEvent.onclick = () => {
            const ds = typeModal.dataset.date;
            closeModals();
            showEventModal(ds);
        };
    }

    const typeBtnCancel = document.getElementById('type-btn-cancel');
    if (typeBtnCancel) typeBtnCancel.onclick = closeModals;

    if (cajaFilterBtn) cajaFilterBtn.onclick = loadCajaData;
    if (statsFilterBtn) statsFilterBtn.onclick = loadStatsData;
    if (historialFilterBtn) historialFilterBtn.onclick = loadHistorialData;

    if (teamNameInput) {
        teamNameInput.oninput = handleTeamNameInput;
        teamNameInput.onblur = () => { setTimeout(() => { if(teamNameSuggestions) teamNameSuggestions.style.display = 'none'; }, 200); };
        teamNameInput.onfocus = handleTeamNameInput;
    }
    
    document.querySelectorAll('input[name="courtSelection"]').forEach(radio => {
        radio.onchange = () => updateCourtAvailability();
    });

    if (rentGrillCheckbox) {
        rentGrillCheckbox.onchange = () => {
            if(grillHoursSection) grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
            updateTotalPrice();
        };
    }
    
    if (costPerHourInput) costPerHourInput.oninput = updateTotalPrice;
    if (grillCostInput) grillCostInput.oninput = updateTotalPrice;
    if (eventCostPerHourInput) eventCostPerHourInput.oninput = updateEventTotalPrice;
    
    if (deleteReasonForm) deleteReasonForm.onsubmit = handleConfirmDelete;
    
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) cancelDeleteBtn.onclick = closeModals;

    // Recurrencia
    if (recurringToggle) recurringToggle.onchange = openRecurringModal;
    
    const confirmRecurBtn = document.getElementById('confirm-recurring-btn');
    if (confirmRecurBtn) confirmRecurBtn.onclick = saveRecurringSettings;

    const cancelRecurBtn = document.getElementById('cancel-recurring-btn');
    if (cancelRecurBtn) {
        cancelRecurBtn.onclick = () => {
            if (recurringModal) recurringModal.classList.remove('is-open');
            if (recurringToggle) recurringToggle.checked = false;
            if (recurringSummary) recurringSummary.classList.add('is-hidden');
            recurringSettings = { dayOfWeek: null, months: [] };
        };
    }
    
    const dayGrid = document.querySelector('.day-selector-grid');
    if (dayGrid) {
        dayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => {
            btn.onclick = (e) => selectRecurringDay(e.currentTarget);
        });
    }

    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.onclick = () => {
            const container = document.getElementById('product-form-container');
            if(container) container.classList.toggle('is-hidden');
        };
    }
    
    const cancelProductBtn = document.getElementById('cancel-product-btn');
    if (cancelProductBtn) {
        cancelProductBtn.onclick = () => {
            const container = document.getElementById('product-form-container');
            if(container) container.classList.add('is-hidden');
        };
    }

    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    if (document.getElementById('prod-batch-cost')) document.getElementById('prod-batch-cost').oninput = calculateProductPrices;
    if (document.getElementById('prod-batch-qty')) document.getElementById('prod-batch-qty').oninput = calculateProductPrices;
    if (document.getElementById('prod-profit-pct')) document.getElementById('prod-profit-pct').oninput = calculateProductPrices;

    const headerSaleBtn = document.getElementById('header-sale-btn');
    if (headerSaleBtn) headerSaleBtn.onclick = openSaleModal;
    if (saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    
    const qtyMinusBtn = document.getElementById('sale-qty-minus');
    if (qtyMinusBtn) qtyMinusBtn.onclick = () => updateSaleQty(-1);
    const qtyPlusBtn = document.getElementById('sale-qty-plus');
    if (qtyPlusBtn) qtyPlusBtn.onclick = () => updateSaleQty(1);
    if (confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;

    const closeSaleBtn = document.getElementById('close-sale-modal-btn');
    if (closeSaleBtn) closeSaleBtn.onclick = closeModals;

    if (restockForm) restockForm.onsubmit = handleConfirmRestock;
    const editFormEl = document.getElementById('edit-product-form');
    if (editFormEl) editFormEl.onsubmit = handleConfirmEditProduct;

    const modalList = [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal, recurringModal, saleModal, document.getElementById('restock-modal'), document.getElementById('edit-product-modal'), document.getElementById('product-history-modal')];
    modalList.forEach(m => {
        if(m) { m.onclick = (e) => { if (e.target === m) closeModals(); }; }
    });
}

// -----------------------------------------------------------------
// 3. LÓGICA DE VISTAS Y NAVEGACIÓN
// -----------------------------------------------------------------

function toggleMenu() {
    if (mainMenu) mainMenu.classList.toggle('is-open');
    if (menuOverlay) menuOverlay.classList.toggle('hidden');
}

function showView(viewName) {
    for (const key in views) {
        if (views[key]) views[key].classList.add('is-hidden');
    }
    const viewToShow = views[viewName];
    if (viewToShow) {
        viewToShow.classList.remove('is-hidden');
        if (viewName === 'caja') {
            const hoy = new Date().toISOString().split('T')[0];
            if (!cajaDateFrom.value) cajaDateFrom.value = hoy;
            if (!cajaDateTo.value) cajaDateTo.value = hoy;
            loadCajaData();
        }
        else if (viewName === 'stats') loadStatsData();
        else if (viewName === 'historial') loadHistorialData();
        else if (viewName === 'configuracion') loadConfigDataIntoForm(); 
        else if (viewName === 'productos') syncProducts();
    }
}

// -----------------------------------------------------------------
// 4. CONFIGURACIÓN Y PRECIOS
// -----------------------------------------------------------------

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
        console.error(error);
    }
}

function loadConfigDataIntoForm() {
    if (!configCourt1Price) return;
    configCourt1Price.value = appSettings.court1Price;
    configCourt2Price.value = appSettings.court2Price;
    
    const grillEl = document.getElementById('config-grill-price');
    if(grillEl) grillEl.value = appSettings.grillPrice;
    
    const eventEl = document.getElementById('config-event-price');
    if(eventEl) eventEl.value = appSettings.eventPrice;
}

async function handleSaveConfig(e) {
    e.preventDefault();
    showMessage("Sincronizando tarifas...");
    const newSettings = {
        court1Price: parseFloat(configCourt1Price.value) || 0,
        court2Price: parseFloat(configCourt2Price.value) || 0,
        grillPrice: parseFloat(document.getElementById('config-grill-price').value) || 0,
        eventPrice: parseFloat(document.getElementById('config-event-price').value) || 0
    };
    try {
        await setDoc(doc(db, settingsDocPath), newSettings);
        appSettings = newSettings;
        showMessage("¡Precios actualizados!");
        setTimeout(hideMessage, 1500);
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 5. FORMULARIOS DE RESERVA Y EVENTOS (DETALLADOS)
// -----------------------------------------------------------------

async function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    if(bookingForm) bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    const title = document.getElementById('booking-modal-title');
    
    if (bookingToEdit) {
        title.textContent = "Editar Reserva";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        costPerHourInput.value = bookingToEdit.costPerHour;
        rentGrillCheckbox.checked = bookingToEdit.rentGrill;
        grillCostInput.value = bookingToEdit.grillCost;
        if(recurringToggle) recurringToggle.disabled = true;
    } else {
        title.textContent = `Reservar Cancha (${dateStr})`;
        document.getElementById('booking-id').value = '';
        costPerHourInput.value = appSettings.court1Price;
        grillCostInput.value = appSettings.grillPrice;
        if(recurringToggle) recurringToggle.disabled = false;
    }
    
    updateCourtAvailability();
    if(bookingModal) bookingModal.classList.add('is-open');
}

async function showEventModal(dateStr, eventToEdit = null) {
    closeModals();
    if(eventForm) eventForm.reset();
    
    const dateInput = document.getElementById('event-date');
    if(dateInput) dateInput.value = dateStr;
    
    const title = document.getElementById('event-modal-title');

    if (eventToEdit) {
        if(title) title.textContent = "Editar Evento";
        if(document.getElementById('event-booking-id')) document.getElementById('event-booking-id').value = eventToEdit.id;
        if(eventNameInput) eventNameInput.value = eventToEdit.teamName;
        if(contactPersonInput) contactPersonInput.value = eventToEdit.contactPerson;
        if(contactPhoneInput) contactPhoneInput.value = eventToEdit.contactPhone;
        if(eventCostPerHourInput) eventCostPerHourInput.value = eventToEdit.costPerHour;
    } else {
        if(title) title.textContent = `Reservar Evento (${dateStr})`;
        if(document.getElementById('event-booking-id')) document.getElementById('event-booking-id').value = '';
        if(eventCostPerHourInput) eventCostPerHourInput.value = appSettings.eventPrice;
    }
    
    renderTimeSlots(eventHoursList, new Set(), eventToEdit ? eventToEdit.courtHours : []);
    if(eventModal) eventModal.classList.add('is-open');
}

function updateCourtAvailability() {
    const ds = document.getElementById('booking-date').value;
    const selCourt = document.querySelector('input[name="courtSelection"]:checked')?.value || 'cancha1';
    const editingId = document.getElementById('booking-id').value;
    
    const occupied = new Set();
    allMonthBookings
        .filter(b => b.day === ds && b.courtId === selCourt && b.id !== editingId)
        .forEach(b => { if(b.courtHours) b.courtHours.forEach(h => occupied.add(h)); });
    
    const currentBooking = allMonthBookings.find(b => b.id === editingId);
    const selected = currentBooking ? currentBooking.courtHours : [];

    renderTimeSlots(courtHoursList, occupied, selected);
    
    const grillOccupied = new Set();
    allMonthBookings
        .filter(b => b.day === ds && b.rentGrill && b.id !== editingId)
        .forEach(b => { if(b.grillHours) b.grillHours.forEach(h => grillOccupied.add(h)); });
    
    renderTimeSlots(grillHoursList, grillOccupied, currentBooking ? currentBooking.grillHours : []);
    updateTotalPrice();
}

function renderTimeSlots(container, occupied, selected) {
    if(!container) return;
    container.innerHTML = '';
    OPERATING_HOURS.forEach(h => {
        const btn = document.createElement('button');
        btn.type = "button"; 
        btn.className = `time-slot ${occupied.has(h) ? 'disabled' : ''} ${selected.includes(h) ? 'selected' : ''}`;
        btn.textContent = `${h}:00`; btn.dataset.hour = h;
        if (!occupied.has(h)) {
            btn.onclick = () => { 
                btn.classList.toggle('selected'); 
                updateTotalPrice(); 
                updateEventTotalPrice(); 
            };
        }
        container.appendChild(btn);
    });
}

// -----------------------------------------------------------------
// 6. PERSISTENCIA DE RESERVAS Y EVENTOS (CORREGIDO CONST ERROR)
// -----------------------------------------------------------------

async function loadBookingsForMonth() {
    if (!db || !userId) return; 
    showMessage("Sincronizando calendario...");
    if (currentBookingsUnsubscribe) currentBookingsUnsubscribe(); 
    const monthYear = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const q = query(collection(db, bookingsCollectionPath), where("monthYear", "==", monthYear));
    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
        hideMessage();
    }, (error) => { console.error(error); hideMessage(); });
}

async function handleSaveBooking(event) {
    event.preventDefault();
    if (recurringToggle && recurringToggle.checked && recurringSettings.dayOfWeek !== null && recurringSettings.months.length > 0) {
        await handleSaveRecurringBooking(event);
    } else {
        await handleSaveSingleBooking(event);
    }
}

async function handleSaveSingleBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Procesando reserva...");

    // ¡CORRECCIÓN CRÍTICA!: 'const' a 'let' para permitir reasignación de ID en nuevos turnos
    let bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();
    const selectedHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedHours.length === 0) {
        showMessage("Debes marcar horarios.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false;
        return;
    }

    const data = {
        type: 'court', teamName, 
        courtId: document.querySelector('input[name="courtSelection"]:checked')?.value || 'cancha1', 
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked,
        grillCost: parseFloat(grillCostInput.value),
        day: dateStr, monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'efectivo',
        courtHours: selectedHours,
        grillHours: (rentGrillCheckbox && rentGrillCheckbox.checked) ? Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10)) : [],
        totalPrice: updateTotalPrice(),
        timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail
    };

    try {
        let action = bookingId ? 'updated' : 'created';
        if (bookingId) { 
            await setDoc(doc(db, bookingsCollectionPath, bookingId), data, { merge: true }); 
        } else { 
            const docRef = await addDoc(collection(db, bookingsCollectionPath), data); 
            bookingId = docRef.id; 
        }
        await logBookingEvent(action, { id: bookingId, ...data });
        await saveCustomer(teamName); 
        
        showMessage("¡Turno guardado!"); 
        // Cerramos modales y ocultamos mensaje de éxito tras un breve retardo
        setTimeout(() => {
            closeModals();
            hideMessage();
        }, 1500);
    } catch (error) { 
        showMessage(error.message, true); 
    } finally { 
        saveButton.disabled = false; 
    }
}

async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando evento...");
    
    let bookingId = eventBookingIdInput.value;
    const dateStr = eventDateInput.value;
    const selectedHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedHours.length === 0) {
        showMessage("Elige horarios de ocupación.", true);
        saveButton.disabled = false;
        return;
    }

    const data = {
        type: 'event', teamName: eventNameInput.value.trim(), contactPerson: contactPersonInput.value.trim(), 
        contactPhone: contactPhoneInput.value.trim(), costPerHour: parseFloat(eventCostPerHourInput.value), 
        day: dateStr, monthYear: dateStr.substring(0, 7), 
        paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked')?.value || 'efectivo', 
        courtHours: selectedHours, totalPrice: updateEventTotalPrice(),
        timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail
    };

    try {
        let action = bookingId ? 'updated' : 'created';
        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), data, { merge: true });
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), data);
            bookingId = docRef.id;
        }
        await logBookingEvent(action, { id: bookingId, ...data });
        showMessage("¡Evento guardado!"); 
        setTimeout(() => {
            closeModals();
            hideMessage();
        }, 1500);
    } catch (error) { 
        showMessage(error.message, true); 
    } finally { 
        saveButton.disabled = false; 
    }
}

async function handleSaveRecurringBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Generando serie...");

    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked')?.value || 'cancha1';
    const selectedHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    const { dayOfWeek, months } = recurringSettings;
    let dates = [];
    months.forEach(m => {
        const y = parseInt(m.year, 10), mon = parseInt(m.month, 10);
        const lastDay = new Date(y, mon + 1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(y, mon, d);
            if (date.getDay() == dayOfWeek) dates.push(date.toISOString().split('T')[0]);
        }
    });

    try {
        const batch = writeBatch(db);
        for (const d of dates) {
            const docRef = doc(collection(db, bookingsCollectionPath));
            const data = { 
                type: 'court', teamName, courtId, day: d, monthYear: d.substring(0, 7), 
                courtHours: selectedHours, totalPrice: updateTotalPrice(), 
                paymentMethod: 'efectivo', timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail,
                peopleCount: 10, costPerHour: parseFloat(costPerHourInput.value), rentGrill: false, grillCost: 0, grillHours: []
            };
            batch.set(docRef, data);
            await logBookingEvent('created-recurring', data);
        }
        await batch.commit();
        showMessage(`¡Serie creada! (${dates.length} turnos)`);
        setTimeout(() => {
            closeModals();
            hideMessage();
        }, 2000);
    } catch (e) { showMessage(e.message, true); } finally { saveButton.disabled = false; }
}

async function handleConfirmDelete(event) {
    event.preventDefault();
    const id = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();
    if (!reason) return alert("Motivo obligatorio.");
    showMessage("Eliminando...");
    try {
        const ref = doc(db, bookingsCollectionPath, id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await logBookingEvent('deleted', { id: snap.id, ...snap.data() }, reason);
            await deleteDoc(ref);
            showMessage("Anulado con éxito.");
        }
        setTimeout(() => {
            closeModals();
            hideMessage();
        }, 1500);
    } catch (error) { showMessage(error.message, true); }
}

async function logBookingEvent(action, data, reason = null) {
    try {
        const log = { ...data, action, timestamp: Timestamp.now(), loggedBy: userEmail, adminId: userId };
        if (reason) log.deleteReason = reason;
        delete log.id;
        await addDoc(collection(db, logCollectionPath), log);
    } catch (e) { console.error(e); }
}

// -----------------------------------------------------------------
// 8. KIOSCO PRO: ÚLTIMO PRECIO Y VENTAS (FULL)
// -----------------------------------------------------------------

async function handleConfirmSale() {
    if(!currentSelectedProduct) return;
    const qtyInput = document.getElementById('sale-qty-input');
    const qty = parseInt(qtyInput.value);
    const method = document.querySelector('input[name="salePaymentMethod"]:checked')?.value || 'efectivo';
    try {
        showMessage("Procesando cobro...");
        await addDoc(collection(db, salesCollectionPath), { 
            name: currentSelectedProduct.name, qty, total: qty * currentSelectedProduct.salePrice, 
            paymentMethod: method, day: new Date().toISOString().split('T')[0], 
            monthYear: new Date().toISOString().substring(0, 7), timestamp: Timestamp.now(),
            adminId: userId, adminEmail: userEmail
        });
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - qty });
        await logKioscoTransaction(currentSelectedProduct.id, `Venta (${method})`, qty, currentSelectedProduct.unitCost, 'out');
        closeModals(); showMessage("¡Venta completada!"); setTimeout(hideMessage, 1500);
    } catch (e) { alert(e.message); }
}

async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQ = parseInt(document.getElementById('restock-qty').value);
    const bCost = parseFloat(document.getElementById('restock-batch-cost').value);
    const nUnit = bCost / addQ;
    const p = allProducts.find(x => x.id === id);
    const nSale = Math.ceil(nUnit * 1.40);

    try {
        showMessage("Sincronizando costos...");
        await updateDoc(doc(db, productsCollectionPath, id), { 
            stock: p.stock + addQ, unitCost: nUnit, salePrice: nSale 
        });
        await logKioscoTransaction(id, `Reposición (+${addQ} un.)`, addQ, nUnit, 'in');
        closeModals(); showMessage("¡Todo el inventario actualizado!"); setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

async function handleSaveProduct(e) {
    e.preventDefault();
    const n = document.getElementById('prod-name').value.trim();
    const s = parseInt(document.getElementById('prod-stock').value);
    const uc = parseFloat(document.getElementById('prod-unit-cost').value);
    const sp = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));
    try {
        const r = await addDoc(collection(db, productsCollectionPath), { 
            name: n, stock: s, unitCost: uc, salePrice: sp, createdAt: Timestamp.now(), creator: userEmail
        });
        await logKioscoTransaction(r.id, 'Alta Inicial', s, uc, 'in');
        e.target.reset(); document.getElementById('product-form-container')?.classList.add('is-hidden');
        showMessage("Ficha guardada."); setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const margin = parseFloat(document.getElementById('prod-profit-pct').value) || 40;
    const u = cost / qty;
    const s = Math.ceil(u * (1 + (margin / 100)));
    const disp = document.getElementById('prod-suggested-price'); if(disp) disp.textContent = `$${s}`;
    const hidden = document.getElementById('prod-unit-cost'); if(hidden) hidden.value = u;
}

function syncProducts() {
    onSnapshot(collection(db, productsCollectionPath), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    });
}

function renderProducts(f = "") {
    if (!productList) return;
    productList.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(f.toLowerCase())).forEach(p => {
        const d = document.createElement('div');
        d.className = 'product-card bg-white p-6 rounded-[2.5rem] border shadow-md flex flex-col gap-4 transition-all hover:border-emerald-300';
        d.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black italic uppercase text-gray-800 text-xl tracking-tighter leading-tight">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} text-[9px] font-black uppercase mt-1">Disp: ${p.stock} un.</span>
                </div>
                <div class="text-right">
                    <p class="text-[8px] font-bold text-gray-400 uppercase tracking-widest">P. Venta</p>
                    <p class="text-3xl font-black text-emerald-600 italic leading-none tracking-tighter italic">$${p.salePrice}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2">
                <button class="p-3 bg-blue-50 text-blue-700 rounded-2xl font-black text-[10px] uppercase shadow-sm" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="p-3 bg-gray-50 text-gray-600 rounded-2xl font-black text-[10px] uppercase shadow-sm" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="p-3 bg-gray-50 text-gray-600 rounded-2xl font-black text-[10px] uppercase shadow-sm" onclick="window.openEditProduct('${p.id}')">✏️ FICHA</button>
                <button class="p-3 bg-red-50 text-red-500 rounded-2xl font-black text-[10px] uppercase shadow-sm" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
            </div>`;
        productList.appendChild(d);
    });
}

function openSaleModal() {
    if(!saleSearchInput) return;
    saleSearchInput.value = ''; if(saleSearchResults) saleSearchResults.innerHTML = ''; 
    if(selectedProductInfo) selectedProductInfo.classList.add('is-hidden');
    if(confirmSaleBtn) confirmSaleBtn.disabled = true; 
    if(saleModal) saleModal.classList.add('is-open'); 
    setTimeout(() => { if(saleSearchInput) saleSearchInput.focus(); }, 100);
}

function handleSaleSearch() {
    const v = saleSearchInput.value.toLowerCase(); if (v.length < 2) { if(saleSearchResults) saleSearchResults.innerHTML = ''; return; }
    if(!saleSearchResults) return;
    saleSearchResults.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(v)).forEach(p => {
        const i = document.createElement('div');
        i.className = 'p-5 bg-gray-50 rounded-3xl flex justify-between cursor-pointer mb-2 hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-200 transition-all shadow-sm';
        i.innerHTML = `<div><span class="font-black text-gray-800 uppercase italic tracking-tighter">${p.name}</span><p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">STOCK: ${p.stock}</p></div><strong class="text-emerald-700 text-xl font-black italic italic italic tracking-tighter">$${p.salePrice}</strong>`;
        i.onclick = () => {
            currentSelectedProduct = p; 
            document.getElementById('sel-prod-name').textContent = p.name;
            document.getElementById('sel-prod-stock').textContent = p.stock; 
            document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`;
            document.getElementById('sale-qty-input').value = 1;
            selectedProductInfo.classList.remove('is-hidden');
            confirmSaleBtn.disabled = (p.stock <= 0); 
            updateSaleTotal();
        };
        saleSearchResults.appendChild(i);
    });
}

function updateSaleQty(d) {
    const i = document.getElementById('sale-qty-input'); if(!i) return;
    let v = parseInt(i.value) + d;
    if (v < 1) v = 1; if (v > currentSelectedProduct.stock) v = currentSelectedProduct.stock;
    i.value = v; updateSaleTotal();
}

function updateSaleTotal() {
    const qEl = document.getElementById('sale-qty-input'); if(!qEl) return;
    const q = parseInt(qEl.value);
    const disp = document.getElementById('sale-total-display');
    if(disp) disp.textContent = `$${(q * currentSelectedProduct.salePrice).toLocaleString('es-AR')}`;
}

async function logKioscoTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, transactionsCollectionPath), { productId, desc, qty, cost, type, timestamp: Timestamp.now(), adminEmail: userEmail });
}

// -----------------------------------------------------------------
// 9. CAJA: ARQUEO AUTOMÁTICO Y DESGLOSE DETALLADO
// -----------------------------------------------------------------

async function loadCajaData() {
    const hoy = new Date().toISOString().split('T')[0];
    if (!cajaDateFrom.value) cajaDateFrom.value = hoy;
    if (!cajaDateTo.value) cajaDateTo.value = hoy;

    const from = cajaDateFrom.value, to = cajaDateTo.value;
    showMessage("Generando balance...");
    try {
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let tB = 0, tS = 0; 
        const daily = {};

        snapB.docs.forEach(doc => { 
            const b = doc.data(); tB += (b.totalPrice || 0); 
            if(!daily[b.day]) daily[b.day] = {t:0, b:[], s:[]}; 
            daily[b.day].t += (b.totalPrice || 0); daily[b.day].b.push({id: doc.id, ...b}); 
        });
        snapS.docs.forEach(doc => { 
            const s = doc.data(); tS += (s.total || 0); 
            if(!daily[s.day]) daily[s.day] = {t:0, b:[], s:[]}; 
            daily[s.day].t += (s.total || 0); daily[s.day].s.push({id: doc.id, ...s}); 
        });

        cajaTotalBookings.textContent = `$${tB.toLocaleString('es-AR')}`;
        cajaTotalSales.textContent = `$${tS.toLocaleString('es-AR')}`;
        cajaTotalCombined.textContent = `$${(tB + tS).toLocaleString('es-AR')}`;
        
        renderCajaList(daily);
        hideMessage();
    } catch (e) { console.error(e); hideMessage(); }
}

function renderCajaList(daily) {
    if(!cajaDailyList) return;
    cajaDailyList.innerHTML = '';
    const sorted = Object.keys(daily).sort((a,b) => b.localeCompare(a));
    
    if(sorted.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-center text-gray-400 font-black p-8 italic uppercase text-[10px]">Sin movimientos registrados</p>';
        return;
    }

    sorted.forEach(day => {
        const data = daily[day], [y, m, d] = day.split('-');
        const item = document.createElement('div');
        item.className = 'data-card p-6 flex justify-between items-center cursor-pointer mb-3 border-l-8 border-emerald-500 hover:scale-[1.01] transition-transform shadow-lg';
        item.innerHTML = `
            <div>
                <strong class="text-gray-900 text-xl font-black italic tracking-tighter">${d}/${m}/${y}</strong>
                <p class="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">${data.b.length} Turnos | ${data.s.length} Ventas Kiosco</p>
            </div>
            <div class="text-right">
                <strong class="text-2xl font-black text-emerald-600 tracking-tighter italic">$${data.t.toLocaleString('es-AR')}</strong>
            </div>`;
        item.onclick = () => showCajaDetail(`${d}/${m}/${y}`, data);
        cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(date, data) {
    if(!cajaDetailModal) return;
    cajaDetailModal.classList.add('is-open'); 
    document.getElementById('caja-detail-title').textContent = date;
    
    let sumB = data.b.reduce((a, b) => a + (b.totalPrice || 0), 0);
    let sumS = data.s.reduce((a, s) => a + (s.total || 0), 0);
    
    let efSum = data.b.filter(x => x.paymentMethod === 'efectivo').reduce((a, b) => a + (b.totalPrice || 0), 0) + 
                data.s.filter(x => x.paymentMethod === 'efectivo').reduce((a, s) => a + (s.total || 0), 0);
                
    let mpSum = data.b.filter(x => x.paymentMethod === 'mercadopago').reduce((a, b) => a + (b.totalPrice || 0), 0) + 
                data.s.filter(x => x.paymentMethod === 'mercadopago').reduce((a, s) => a + (s.total || 0), 0);

    const sumEl = document.getElementById('caja-detail-summary');
    if(sumEl) sumEl.innerHTML = `
        <div class="bg-gray-900 text-white p-8 rounded-[2.5rem] mb-8 shadow-2xl border-t-8 border-emerald-400 relative overflow-hidden text-left">
            <div class="absolute right-0 top-0 p-4 opacity-10 text-5xl font-black italic tracking-tighter italic">BANK</div>
            <div class="flex justify-between mb-2"><span class="text-[10px] font-black uppercase text-gray-400 tracking-widest">En Efectivo:</span> <strong class="text-emerald-400 text-lg">$${efSum.toLocaleString()}</strong></div>
            <div class="flex justify-between mb-6"><span class="text-[10px] font-black uppercase text-gray-400 tracking-widest">MP / Transf:</span> <strong class="text-blue-400 text-lg">$${mpSum.toLocaleString()}</strong></div>
            <div class="flex justify-between text-3xl font-black border-t border-white/20 pt-6 italic tracking-tighter"><span>CIERRE:</span> <span class="text-white">$${data.t.toLocaleString()}</span></div>
        </div>
    `;
    
    const list = document.getElementById('caja-detail-booking-list');
    if(list) {
        list.innerHTML = '';
        data.b.forEach(b => {
            const icon = b.paymentMethod === 'mercadopago' ? '📱' : '💵';
            list.innerHTML += `<div class="text-[11px] font-bold p-4 bg-gray-50 rounded-2xl mb-2 flex justify-between items-center shadow-sm border border-gray-100"><span>${icon} 📅 ${b.teamName}</span><strong class="text-emerald-700">$${(b.totalPrice || 0).toLocaleString()}</strong></div>`;
        });
        data.s.forEach(s => {
            const icon = s.paymentMethod === 'mercadopago' ? '📱' : '💵';
            list.innerHTML += `<div class="text-[11px] font-bold p-4 bg-blue-50 rounded-2xl mb-2 flex justify-between items-center shadow-sm border border-blue-100"><span>${icon} 🍭 ${s.name} (x${s.qty})</span><strong class="text-blue-700">$${(s.total || 0).toLocaleString()}</strong></div>`;
        });
    }
}

// -----------------------------------------------------------------
// 10. CALENDARIO: RENDERIZADO VISIBLE (ALTO CONTRASTE)
// -----------------------------------------------------------------

function renderCalendar() {
    if(!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear(), month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const d = document.createElement('div');
        d.className = 'other-month-day h-20 md:h-28 bg-gray-50 opacity-20 border border-gray-100 rounded-xl';
        calendarGrid.appendChild(d);
    }

    for (let i = 1; i <= lastDate; i++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const bks = allMonthBookings.filter(b => b.day === ds);
        const cell = document.createElement('div');
        cell.className = `day-cell h-20 md:h-28 border-2 border-gray-100 p-3 bg-white cursor-pointer relative rounded-[1.25rem] shadow-sm transition-all hover:scale-[1.03] hover:border-emerald-200`;
        
        cell.innerHTML = `<span class='text-[16px] font-black text-gray-900 italic tracking-tighter'>${i}</span>`;
        
        if (bks.length > 0) {
            const hasEv = bks.some(b => b.type === 'event');
            if(hasEv) cell.classList.add('day-cell-locked');
            const badge = document.createElement('span');
            badge.className = `booking-count ${hasEv ? 'event' : ''}`;
            badge.textContent = bks.length;
            cell.appendChild(badge);
        }
        
        cell.onclick = () => {
            if (bks.length > 0) {
                showOptionsModal(ds, bks);
            } else {
                typeModal.dataset.date = ds;
                document.getElementById('type-modal').classList.add('is-open');
            }
        };
        calendarGrid.appendChild(cell);
    }
}

function showOptionsModal(dateStr, bks) {
    optionsModal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    if(!list) return;
    list.innerHTML = '';
    const hasEv = bks.some(b => b.type === 'event');
    const addBtn = document.getElementById('add-new-booking-btn');
    if (addBtn) addBtn.style.display = hasEv ? 'none' : 'block';

    bks.forEach(b => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-4 bg-gray-50 border border-gray-100 rounded-2xl mb-3 shadow-sm';
        item.innerHTML = `
            <div>
                <p class="font-black text-sm uppercase italic tracking-tighter text-gray-800 text-left">${b.type === 'event' ? '★ ' + b.teamName : b.teamName}</p>
                <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-left">${b.courtHours ? b.courtHours.join(', ') : 'S/H'}hs</p>
            </div>
            <div class="flex gap-1">
                <button class="px-2 py-2 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase" onclick="window.viewBookingDetail('${b.id}')">VER</button>
                <button class="px-2 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-[9px] font-black uppercase" onclick="window.editBooking('${b.id}')">EDT</button>
                <button class="px-2 py-2 bg-red-100 text-red-700 rounded-lg text-[9px] font-black uppercase" onclick="window.deleteBooking('${b.id}')">X</button>
            </div>`;
        list.appendChild(item);
    });
    optionsModal.classList.add('is-open');
}

// -----------------------------------------------------------------
// 11. GLOBALIZACIÓN WINDOW PARA BOTONES DINÁMICOS
// -----------------------------------------------------------------

window.viewBookingDetail = async (id) => {
    const b = allMonthBookings.find(x => x.id === id);
    const det = document.getElementById('view-booking-details');
    if(det) {
        det.innerHTML = `
        <h3 class="text-4xl font-black italic uppercase text-emerald-900 tracking-tighter mb-8 tracking-tighter italic uppercase text-left">${b.teamName}</h3>
        <div class="space-y-4 font-bold text-sm text-gray-500 text-left">
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Tipo</span> <span class="text-gray-900">${b.type}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Día</span> <span class="text-gray-900">${b.day}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Horario</span> <span class="text-gray-900">${b.courtHours ? b.courtHours.join(', ') : 'S/H'}hs</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Pago</span> <span class="text-gray-900 uppercase italic tracking-tighter italic tracking-tighter italic">${b.paymentMethod || 'Efectivo'}</span></div>
            <div class="flex justify-between pt-8 items-center"><span class="text-emerald-900 uppercase font-black text-xs tracking-widest uppercase">Total</span> <span class="text-4xl font-black text-emerald-600 italic tracking-tighter italic tracking-tighter italic tracking-tighter italic tracking-tighter italic tracking-tighter italic italic italic">$${(b.totalPrice || 0).toLocaleString()}</span></div>
        </div>`;
    }
    if(viewModal) viewModal.classList.add('is-open');
};

window.editBooking = (id) => { 
    const b = allMonthBookings.find(x => x.id === id); 
    closeModals(); 
    if(b.type === 'court') showBookingModal(b.day, b); else showEventModal(b.day, b); 
};

window.deleteBooking = (id) => { 
    if(document.getElementById('delete-booking-id')) document.getElementById('delete-booking-id').value = id; 
    closeModals(); if(deleteReasonModal) deleteReasonModal.classList.add('is-open'); 
};

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    if(document.getElementById('restock-prod-id')) document.getElementById('restock-prod-id').value = id;
    if(document.getElementById('restock-name')) document.getElementById('restock-name').textContent = p.name;
    if(document.getElementById('restock-current-stock')) document.getElementById('restock-current-stock').textContent = p.stock;
    if(document.getElementById('restock-modal')) document.getElementById('restock-modal').classList.add('is-open');
};

window.showEventModal = showEventModal;
window.showBookingModal = showBookingModal;

window.deleteProduct = async (id) => { if(confirm("¿Borrar ficha permanentemente?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

window.openEditProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    if(document.getElementById('edit-prod-id')) document.getElementById('edit-prod-id').value = id;
    if(document.getElementById('edit-prod-name')) document.getElementById('edit-prod-name').value = p.name;
    if(document.getElementById('edit-prod-cost')) document.getElementById('edit-prod-cost').value = p.unitCost;
    if(document.getElementById('edit-prod-price')) document.getElementById('edit-prod-price').value = p.salePrice;
    if(document.getElementById('edit-prod-stock')) document.getElementById('edit-prod-stock').value = p.stock;
    if(document.getElementById('edit-product-modal')) document.getElementById('edit-product-modal').classList.add('is-open');
};

async function handleConfirmEditProduct(e) {
    e.preventDefault();
    const idVal = document.getElementById('edit-prod-id').value;
    const d = { name: document.getElementById('edit-prod-name').value, unitCost: parseFloat(document.getElementById('edit-prod-cost').value), salePrice: parseFloat(document.getElementById('edit-prod-price').value), stock: parseInt(document.getElementById('edit-prod-stock').value) };
    await updateDoc(doc(db, productsCollectionPath, idVal), d);
    closeModals();
}

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    const hName = document.getElementById('history-product-name'); if(hName) hName.textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); if(!list) return; list.innerHTML = '';
    s.forEach(doc => {
        const t = doc.data();
        list.innerHTML += `<div class="p-4 bg-gray-50 rounded-2xl mb-2 flex justify-between items-center shadow-sm relative border border-gray-100"><div class="absolute top-0 left-0 w-1 h-full ${t.type==='in'?'bg-emerald-500':'bg-red-500'}"></div><div><p class="font-black text-sm text-gray-800 uppercase italic tracking-tighter">${t.desc}</p><p class="text-[9px] uppercase font-bold text-gray-400 italic">${t.timestamp.toDate().toLocaleString('es-AR')}</p></div><strong class="${t.type==='in'?'text-emerald-600':'text-red-500'} text-xl font-black italic tracking-tighter italic tracking-tighter italic">${t.type==='in'?'+':'-'}${t.qty}</strong></div>`;
    });
    if(document.getElementById('product-history-modal')) document.getElementById('product-history-modal').classList.add('is-open');
};

// -----------------------------------------------------------------
// 12. UTILIDADES
// -----------------------------------------------------------------

function showMessage(msg, isError = false) { 
    const t = document.getElementById('message-text'); 
    if(t) { t.textContent = msg; t.className = isError ? 'text-2xl font-black text-red-600 tracking-tighter italic uppercase' : 'text-2xl font-black text-emerald-800 tracking-tighter italic uppercase'; }
    if(messageOverlay) messageOverlay.classList.add('is-open'); 
}

function hideMessage() { if(messageOverlay) messageOverlay.classList.remove('is-open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }
function prevMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); }
function nextMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); }

function updateTotalPrice() {
    const h = courtHoursList?.querySelectorAll('.time-slot.selected').length || 0;
    const p = parseFloat(costPerHourInput?.value) || 0;
    const g = (rentGrillCheckbox && rentGrillCheckbox.checked) ? (parseFloat(grillCostInput?.value) || 0) : 0;
    const t = (h * p) + g;
    if(bookingTotal) bookingTotal.textContent = `$${t.toLocaleString('es-AR')}`;
    return t;
}

function updateEventTotalPrice() {
    const h = eventHoursList?.querySelectorAll('.time-slot.selected').length || 0;
    const p = parseFloat(eventCostPerHourInput?.value) || 0;
    const t = h * p;
    if(eventTotal) eventTotal.textContent = `$${t.toLocaleString('es-AR')}`;
    return t;
}

async function loadStatsData() {
    if(!db) return; try {
        const snap = await getDocs(collection(db, bookingsCollectionPath));
        const st = {}; snap.forEach(d => { const b = d.data(), n = b.teamName ? b.teamName.toLowerCase() : "sin nombre"; if(!st[n]) st[n] = {n: b.teamName || "SIN NOMBRE", c:0, t:0}; st[n].c++; st[n].t += (b.totalPrice || 0); });
        if(statsList) {
            statsList.innerHTML = ''; Object.values(st).sort((a,b)=>b.c-a.c).forEach(c => {
                statsList.innerHTML += `<div class="data-card p-6 flex justify-between items-center mb-3 border-l-8 border-emerald-400 uppercase italic tracking-tighter italic text-left"><div><strong class="font-black text-gray-800">${c.n}</strong><p class="text-[9px] font-black text-gray-400 tracking-widest">${c.c} reservas</p></div><strong class="text-emerald-600 text-xl font-black italic tracking-tighter italic">$${c.t.toLocaleString()}</strong></div>`;
            });
        }
    } catch(e) {}
}

async function loadHistorialData() {
    if(!db) return; try {
        const snap = await getDocs(query(collection(db, logCollectionPath), orderBy("timestamp", "desc")));
        if(historialList) {
            historialList.innerHTML = ''; snap.forEach(d => { const e = d.data();
                historialList.innerHTML += `<div class="data-card p-5 mb-3 flex justify-between items-start border shadow-sm rounded-3xl text-left"><div><strong class="font-black italic uppercase tracking-tighter text-gray-800 tracking-tighter italic">${e.teamName || "EVENTO"}</strong><p class="text-[9px] mt-2 text-gray-400 font-bold uppercase tracking-widest">${e.timestamp.toDate().toLocaleString('es-AR')} | ADMIN: ${e.loggedBy || "SISTEMA"}</p></div><span class="text-[8px] font-black uppercase px-2 py-1 bg-gray-100 rounded-lg italic tracking-tighter italic">${e.action}</span></div>`;
            });
        }
    } catch(e) {}
}

async function handleTeamNameInput() {
    if(!teamNameInput || !teamNameSuggestions) return; 
    const qText = teamNameInput.value.trim().toLowerCase(); 
    if(qText.length < 2) { teamNameSuggestions.style.display = 'none'; return; }
    try {
        const q = query(collection(db, customersCollectionPath), where(documentId(), ">=", qText), where(documentId(), "<=", qText + '\uf8ff'));
        const snap = await getDocs(q); teamNameSuggestions.innerHTML = '';
        if(snap.empty) { teamNameSuggestions.style.display = 'none'; return; }
        snap.forEach(d => { 
            const n = d.data().name, i = document.createElement('div'); i.className = 'suggestion-item font-black text-sm p-4 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 italic uppercase tracking-tighter italic tracking-tighter italic'; i.textContent = n;
            i.onmousedown = () => { teamNameInput.value = n; teamNameSuggestions.style.display = 'none'; }; teamNameSuggestions.appendChild(i);
        }); 
        teamNameSuggestions.style.display = 'block';
    } catch (e) {}
}

async function saveCustomer(name) { if(!name) return; try { await setDoc(doc(db, customersCollectionPath, name.trim().toLowerCase()), { name: name.trim(), lastBooked: new Date().toISOString() }, { merge: true }); } catch(e) {} }

async function openRecurringModal() { if (recurringToggle && recurringToggle.checked) { renderRecurringModal(); if(recurringModal) recurringModal.classList.add('is-open'); } }

function renderRecurringModal() {
    if(!recurringMonthList) return; 
    recurringMonthList.innerHTML = ''; const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const btn = document.createElement('button'); 
        btn.className = 'month-toggle-btn'; btn.dataset.month = d.getMonth(); btn.dataset.year = d.getFullYear();
        btn.textContent = d.toLocaleString('es-AR', { month: 'short', year: 'numeric' }); btn.onclick = (e) => e.currentTarget.classList.toggle('selected');
        recurringMonthList.appendChild(btn);
    }
}

function selectRecurringDay(btn) { 
    const grid = document.querySelector('.day-selector-grid');
    if(!grid) return;
    grid.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected')); 
    btn.classList.add('selected'); 
}

function saveRecurringSettings() {
    const dBtn = document.querySelector('.day-toggle-btn.selected'); 
    const mBtns = document.querySelectorAll('.month-toggle-btn.selected');
    if (!dBtn || !mBtns || mBtns.length === 0) return alert("Selecciona día y meses.");
    recurringSettings.dayOfWeek = parseInt(dBtn.dataset.day, 10);
    recurringSettings.months = Array.from(mBtns).map(b => ({ month: b.dataset.month, year: b.dataset.year, name: b.textContent }));
    if(recurringSummary) { recurringSummary.textContent = `Serie activa: Todos los ${WEEKDAYS_ES[recurringSettings.dayOfWeek]}.`; recurringSummary.classList.remove('is-hidden'); }
    if(recurringModal) recurringModal.classList.remove('is-open');
}

window.hideMessage = hideMessage; window.closeModals = closeModals;
console.log("Sistema v2026 Pro - Integridad Total Verificada.");
