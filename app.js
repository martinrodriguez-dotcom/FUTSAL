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

// --- VARIABLES GLOBALES ---
let db, auth, userId = null, userEmail = null; 
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
let allProducts = []; 
let currentSelectedProduct = null;

let appSettings = { court1Price: 5000, court2Price: 5000, grillPrice: 2000, eventPrice: 10000 };
let recurringSettings = { dayOfWeek: null, months: [] };

// --- REFERENCIAS AL DOM ---
const getEl = (id) => document.getElementById(id);

const loginView = getEl('login-view');
const registerView = getEl('register-view');
const appContainer = getEl('app-container');

const views = {
    calendar: getEl('calendar-view'),
    caja: getEl('caja-view'),
    stats: getEl('stats-view'),
    historial: getEl('historial-view'),
    configuracion: getEl('config-view'),
    productos: getEl('productos-view') 
};

const calendarGrid = getEl('calendar-grid');
const currentMonthYearEl = getEl('current-month-year');
const menuBtn = getEl('menu-btn');
const mainMenu = getEl('main-menu');
const menuOverlay = getEl('menu-overlay');
const userEmailDisplay = getEl('user-email-display'); 
const logoutBtn = getEl('logout-btn'); 

const loginForm = getEl('login-form');
const registerForm = getEl('register-form');

const cajaDailyList = getEl('caja-daily-list');
const cajaTotalCombined = getEl('caja-total-combined');
const cajaTotalBookings = getEl('caja-total-bookings');
const cajaTotalSales = getEl('caja-total-sales');
const cajaDateFrom = getEl('caja-date-from');
const cajaDateTo = getEl('caja-date-to');
const cajaFilterBtn = getEl('caja-filter-btn');

const statsList = getEl('stats-list');
const historialList = getEl('historial-list');

const typeModal = getEl('type-modal'); 
const bookingModal = getEl('booking-modal');
const eventModal = getEl('event-modal'); 
const optionsModal = getEl('options-modal');
const viewModal = getEl('view-modal');
const cajaDetailModal = getEl('caja-detail-modal');
const deleteReasonModal = getEl('delete-reason-modal'); 
const recurringModal = getEl('recurring-modal'); 
const messageOverlay = getEl('message-overlay');

const bookingForm = getEl('booking-form');
const teamNameInput = getEl('teamName');
const teamNameSuggestions = getEl('teamName-suggestions');
const costPerHourInput = getEl('costPerHour');
const grillCostInput = getEl('grillCost');
const rentGrillCheckbox = getEl('rentGrill');
const grillHoursSection = getEl('grill-hours-section');
const courtHoursList = getEl('court-hours-list');
const grillHoursList = getEl('grill-hours-list');
const bookingTotal = getEl('booking-total');
const recurringToggle = getEl('recurring-toggle'); 
const recurringSummary = getEl('recurring-summary'); 

const eventForm = getEl('event-form');
const eventBookingIdInput = getEl('event-booking-id'); 
const eventDateInput = getEl('event-date'); 
const eventNameInput = getEl('eventName');
const contactPersonInput = getEl('contactPerson');
const contactPhoneInput = getEl('contactPhone');
const eventCostPerHourInput = getEl('eventCostPerHour');
const eventHoursList = getEl('event-hours-list');
const eventTotal = getEl('event-total');

const deleteReasonForm = getEl('delete-reason-form');
const deleteReasonText = getEl('delete-reason-text');
const deleteBookingIdInput = getEl('delete-booking-id');

const configForm = getEl('config-form');
const configCourt1Price = getEl('config-court1-price');
const configCourt2Price = getEl('config-court2-price');
const configGrillPrice = getEl('config-grill-price');
const configEventPrice = getEl('config-event-price');

const productForm = getEl('product-form');
const productList = getEl('product-list');
const inventorySearchInput = getEl('inventory-search-input');
const restockForm = getEl('restock-form');
const saleModal = getEl('sale-modal');
const saleSearchInput = getEl('sale-search-input');
const saleSearchResults = getEl('sale-search-results');
const selectedProductInfo = getEl('selected-product-info');
const confirmSaleBtn = getEl('confirm-sale-btn');

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando Cerebro v2026 Pro...");
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
                console.log("Sesión inactiva. Mostrando Login.");
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
        console.error("Fallo crítico de Firebase:", error);
        showMessage(`Error de Red: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 2. CONFIGURACIÓN DE EVENT LISTENERS (RESISTENTE A NULL)
// -----------------------------------------------------------------

function setupEventListeners() {
    const safeBind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el[event] = fn;
    };

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
    
    if (loginForm) loginForm.onsubmit = handleLogin;
    if (registerForm) registerForm.onsubmit = handleRegister;
    
    safeBind('show-register', 'onclick', (e) => {
        e.preventDefault();
        if (loginView) loginView.classList.add('is-hidden');
        if (registerView) registerView.classList.remove('is-hidden');
    });
    
    safeBind('show-login', 'onclick', (e) => {
        e.preventDefault();
        if (registerView) registerView.classList.add('is-hidden');
        if (loginView) loginView.classList.remove('is-hidden');
    });
    
    safeBind('prev-month-btn', 'onclick', prevMonth);
    safeBind('next-month-btn', 'onclick', nextMonth);
    
    if (bookingForm) bookingForm.onsubmit = handleSaveBooking;
    if (eventForm) eventForm.onsubmit = handleSaveEvent; 
    if (configForm) configForm.onsubmit = handleSaveConfig;

    safeBind('cancel-booking-btn', 'onclick', closeModals);
    safeBind('cancel-event-btn', 'onclick', closeModals); 
    safeBind('close-options-btn', 'onclick', closeModals);
    safeBind('close-view-btn', 'onclick', closeModals);
    safeBind('close-caja-detail-btn', 'onclick', closeModals);

    safeBind('add-new-booking-btn', 'onclick', () => {
        const ds = optionsModal.dataset.date;
        closeModals();
        showBookingModal(ds); 
    });

    safeBind('type-btn-court', 'onclick', () => {
        const ds = typeModal.dataset.date;
        closeModals();
        showBookingModal(ds);
    });

    safeBind('type-btn-event', 'onclick', () => {
        const ds = typeModal.dataset.date;
        closeModals();
        showEventModal(ds);
    });

    safeBind('type-btn-cancel', 'onclick', closeModals);

    if (cajaFilterBtn) cajaFilterBtn.onclick = loadCajaData;
    safeBind('stats-filter-btn', 'onclick', loadStatsData);
    safeBind('historial-filter-btn', 'onclick', loadHistorialData);

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
    safeBind('cancel-delete-btn', 'onclick', closeModals);

    if (recurringToggle) recurringToggle.onchange = openRecurringModal;
    safeBind('cancel-recurring-btn', 'onclick', () => {
        if (recurringModal) recurringModal.classList.remove('is-open');
        if (recurringToggle) recurringToggle.checked = false;
        if (recurringSummary) {
            recurringSummary.classList.add('is-hidden');
            recurringSummary.textContent = '';
        }
        recurringSettings = { dayOfWeek: null, months: [] };
    });
    
    safeBind('confirm-recurring-btn', 'onclick', saveRecurringSettings);
    
    const dayGrid = document.querySelector('.day-selector-grid');
    if (dayGrid) {
        dayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => {
            btn.onclick = (e) => selectRecurringDay(e.currentTarget);
        });
    }

    // KIOSCO
    safeBind('add-product-btn', 'onclick', () => document.getElementById('product-form-container')?.classList.toggle('is-hidden'));
    safeBind('cancel-product-btn', 'onclick', () => document.getElementById('product-form-container')?.classList.add('is-hidden'));
    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = calculateProductPrices;
    });

    safeBind('header-sale-btn', 'onclick', openSaleModal);
    if (saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    safeBind('sale-qty-minus', 'onclick', () => updateSaleQty(-1));
    safeBind('sale-qty-plus', 'onclick', () => updateSaleQty(1));
    if (confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;
    safeBind('close-sale-modal-btn', 'onclick', closeModals);

    if (restockForm) restockForm.onsubmit = handleConfirmRestock;
    const editFormEl = document.getElementById('edit-product-form');
    if (editFormEl) editFormEl.onsubmit = handleConfirmEditProduct;

    // Cierre genérico
    const modales = [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal, recurringModal, saleModal, document.getElementById('restock-modal'), document.getElementById('edit-product-modal'), document.getElementById('product-history-modal')];
    modales.forEach(m => {
        if(m) { 
            m.onclick = (e) => {
                if (e.target === m) closeModals();
            };
        }
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
// 4. AUTENTICACIÓN
// -----------------------------------------------------------------

async function handleLogin(e) {
    e.preventDefault();
    showMessage("Validando credenciales...");
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
    showMessage("Creando cuenta de administrador...");
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
        console.error(error);
    }
}

// -----------------------------------------------------------------
// 5. CONFIGURACIÓN Y PRECIOS
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
    configGrillPrice.value = appSettings.grillPrice;
    configEventPrice.value = appSettings.eventPrice;
}

async function handleSaveConfig(e) {
    e.preventDefault();
    showMessage("Actualizando tarifas...");
    const newSettings = {
        court1Price: parseFloat(configCourt1Price.value) || 0,
        court2Price: parseFloat(configCourt2Price.value) || 0,
        grillPrice: parseFloat(configGrillPrice.value) || 0,
        eventPrice: parseFloat(configEventPrice.value) || 0
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
// 6. GESTIÓN DE RESERVAS Y EVENTOS (FULL)
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
    eventDateInput.value = dateStr;
    if (eventToEdit) {
        document.getElementById('event-booking-id').value = eventToEdit.id;
        eventNameInput.value = eventToEdit.teamName;
        contactPersonInput.value = eventToEdit.contactPerson;
        contactPhoneInput.value = eventToEdit.contactPhone;
        eventCostPerHourInput.value = eventToEdit.costPerHour;
    } else {
        eventCostPerHourInput.value = appSettings.eventPrice;
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
        .forEach(b => b.courtHours.forEach(h => occupied.add(h)));
    
    const currentBooking = allMonthBookings.find(b => b.id === editingId);
    const selected = currentBooking ? currentBooking.courtHours : [];

    renderTimeSlots(courtHoursList, occupied, selected);
    
    const grillOccupied = new Set();
    allMonthBookings
        .filter(b => b.day === ds && b.rentGrill && b.id !== editingId)
        .forEach(b => b.grillHours.forEach(h => grillOccupied.add(h)));
    
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
    }, (error) => {
        console.error(error);
        hideMessage();
    });
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
    showMessage("Guardando Turno...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();
    const selectedHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedHours.length === 0) {
        showMessage("Elegí al menos una hora.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false;
        return;
    }

    const data = {
        type: 'court', teamName, 
        courtId: document.querySelector('input[name="courtSelection"]:checked').value, 
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked,
        grillCost: parseFloat(grillCostInput.value),
        day: dateStr, monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
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
            await logBookingEvent(action, { id: docRef.id, ...data });
        }
        if (bookingId) await logBookingEvent(action, { id: bookingId, ...data });
        
        await saveCustomer(teamName); 
        showMessage("¡Turno guardado!");
        closeModals(); 
        setTimeout(hideMessage, 1500); 
    } catch (error) { showMessage(error.message, true); } finally { saveButton.disabled = false; }
}

async function handleSaveRecurringBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Registrando ciclo...");

    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
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
                paymentMethod: 'efectivo', timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail
            };
            batch.set(docRef, data);
            await logBookingEvent('created-recurring', data);
        }
        await batch.commit();
        showMessage(`Serie creada: ${dates.length} turnos.`);
        closeModals(); setTimeout(hideMessage, 2000);
    } catch (e) { showMessage(e.message, true); } finally { saveButton.disabled = false; }
}

async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Evento...");
    const bookingId = eventBookingIdInput.value;
    const selectedHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedHours.length === 0) {
        showMessage("Elegí horarios.", true);
        saveButton.disabled = false;
        return;
    }

    const data = {
        type: 'event', teamName: eventNameInput.value.trim(), contactPerson: contactPersonInput.value.trim(), 
        contactPhone: contactPhoneInput.value.trim(), costPerHour: parseFloat(eventCostPerHourInput.value), 
        day: eventDateInput.value, monthYear: eventDateInput.value.substring(0, 7), 
        paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked').value, 
        courtHours: selectedHours, totalPrice: updateEventTotalPrice(),
        timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail
    };

    try {
        if (bookingId) await setDoc(doc(db, bookingsCollectionPath, bookingId), data, { merge: true });
        else await addDoc(collection(db, bookingsCollectionPath), data);
        showMessage("¡Evento Guardado!");
        closeModals(); setTimeout(hideMessage, 1500);
    } catch (error) { showMessage(error.message, true); } finally { saveButton.disabled = false; }
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
            showMessage("Reserva anulada.");
        }
        closeModals(); setTimeout(hideMessage, 1500); 
    } catch (error) {
        showMessage(error.message, true);
    }
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
// 7. CALENDARIO Y OPCIONES
// -----------------------------------------------------------------

function renderCalendar() {
    if(!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear(), month = currentMonthDate.getMonth();
    if(currentMonthYearEl) currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const d = document.createElement('div'); d.className = 'other-month-day h-20 md:h-28';
        calendarGrid.appendChild(d);
    }

    for (let i = 1; i <= lastDate; i++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const bks = allMonthBookings.filter(b => b.day === ds);
        const cell = document.createElement('div'); cell.className = `day-cell h-20 md:h-28 border p-2 bg-white cursor-pointer relative rounded-xl`;
        cell.innerHTML = `<span class='text-xs font-black opacity-10'>${i}</span>`;
        if (bks.length > 0) {
            const hasEv = bks.some(b => b.type === 'event');
            if(hasEv) cell.classList.add('day-cell-locked');
            const badge = document.createElement('span'); badge.className = `booking-count ${hasEv ? 'event' : ''}`;
            badge.textContent = bks.length; cell.appendChild(badge);
        }
        cell.onclick = () => bks.length > 0 ? showOptionsModal(ds, bks) : (typeModal.dataset.date = ds, typeModal.classList.add('is-open'));
        calendarGrid.appendChild(cell);
    }
}

function showOptionsModal(dateStr, bks) {
    if(!optionsModal) return;
    optionsModal.dataset.date = dateStr;
    const list = document.getElementById('daily-bookings-list');
    if(!list) return;
    list.innerHTML = '';
    const hasEv = bks.some(b => b.type === 'event');
    const addBtn = document.getElementById('add-new-booking-btn');
    if (addBtn) addBtn.style.display = hasEv ? 'none' : 'block';

    bks.forEach(b => {
        const d = document.createElement('div');
        d.className = 'flex justify-between items-center p-3 bg-gray-50 border rounded-xl mb-2 shadow-sm';
        d.innerHTML = `<div><p class="font-bold text-sm uppercase italic tracking-tighter">${b.type === 'event' ? '[E] ' + b.teamName : b.teamName}</p></div>
                       <div class="flex gap-1">
                           <button class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase" onclick="window.viewBookingDetail('${b.id}')">VER</button>
                           <button class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-black uppercase" onclick="window.editBooking('${b.id}')">EDIT</button>
                           <button class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase" onclick="window.deleteBooking('${b.id}')">X</button>
                       </div>`;
        list.appendChild(d);
    });
    optionsModal.classList.add('is-open');
}

// -----------------------------------------------------------------
// 8. GESTIÓN DE CAJA (ARQUEO PRO)
// -----------------------------------------------------------------

async function loadCajaData() {
    const hoy = new Date().toISOString().split('T')[0];
    if (!cajaDateFrom.value) cajaDateFrom.value = hoy;
    if (!cajaDateTo.value) cajaDateTo.value = hoy;

    const from = cajaDateFrom.value, to = cajaDateTo.value;
    showMessage("Generando arqueo...");
    try {
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let tB = 0, tS = 0; 
        const daily = {};

        snapB.docs.forEach(doc => {
            const b = doc.data(); tB += b.totalPrice; 
            if(!daily[b.day]) daily[b.day] = {t:0, b:[], s:[]}; 
            daily[b.day].t += b.totalPrice; daily[b.day].b.push({id: doc.id, ...b}); 
        });
        snapS.docs.forEach(doc => {
            const s = doc.data(); tS += s.total; 
            if(!daily[s.day]) daily[s.day] = {t:0, b:[], s:[]}; 
            daily[s.day].t += s.total; daily[s.day].s.push({id: doc.id, ...s}); 
        });

        if(cajaTotalBookings) cajaTotalBookings.textContent = `$${tB.toLocaleString('es-AR')}`;
        if(cajaTotalSales) cajaTotalSales.textContent = `$${tS.toLocaleString('es-AR')}`;
        if(cajaTotalCombined) cajaTotalCombined.textContent = `$${(tB + tS).toLocaleString('es-AR')}`;
        
        renderCajaList(daily);
        hideMessage();
    } catch (e) { hideMessage(); }
}

function renderCajaList(daily) {
    if(!cajaDailyList) return;
    cajaDailyList.innerHTML = '';
    const sorted = Object.keys(daily).sort((a,b) => b.localeCompare(a));
    
    if(sorted.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-center text-gray-400 font-black p-8 italic uppercase text-[10px]">Sin movimientos</p>';
        return;
    }

    sorted.forEach(day => {
        const data = daily[day], [y, m, d] = day.split('-');
        const item = document.createElement('div');
        item.className = 'data-card p-6 flex justify-between items-center cursor-pointer mb-3 border-l-8 border-emerald-500 hover:scale-[1.01] transition-transform';
        item.innerHTML = `<div><strong class="text-gray-800 text-xl font-black italic tracking-tighter">${d}/${m}/${y}</strong><p class="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">${data.b.length} Turnos | ${data.s.length} Ventas</p></div><strong class="text-2xl font-black text-emerald-600 tracking-tighter italic">$${data.t.toLocaleString('es-AR')}</strong>`;
        item.onclick = () => showCajaDetail(`${d}/${m}/${y}`, data);
        cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(date, data) {
    if(!cajaDetailModal) return;
    cajaDetailModal.classList.add('is-open'); 
    const title = document.getElementById('caja-detail-title');
    if(title) title.textContent = date;
    
    let sumB = data.b.reduce((a, b) => a + b.totalPrice, 0);
    let sumS = data.s.reduce((a, s) => a + s.total, 0);
    
    const sumEl = document.getElementById('caja-detail-summary');
    if(sumEl) sumEl.innerHTML = `
        <div class="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest"><span>📅 Turnos:</span> <strong class="text-emerald-700">$${sumB.toLocaleString()}</strong></div>
        <div class="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest"><span>🍭 Kiosco:</span> <strong class="text-blue-700">$${sumS.toLocaleString()}</strong></div>
        <div class="flex justify-between text-2xl font-black italic border-t-4 border-gray-900 mt-4 pt-4 tracking-tighter text-gray-900"><span>TOTAL:</span> <strong>$${data.t.toLocaleString()}</strong></div>`;
    
    const list = document.getElementById('caja-detail-booking-list');
    if(list) {
        list.innerHTML = '';
        data.b.forEach(b => list.innerHTML += `<div class="text-[11px] font-bold p-3 bg-gray-50 rounded-xl mb-1 flex justify-between items-center shadow-sm"><span>${b.paymentMethod === 'mercadopago'?'📱':'💵'} 📅 ${b.teamName}</span><strong class="text-emerald-700">$${b.totalPrice.toLocaleString()}</strong></div>`);
        data.s.forEach(s => list.innerHTML += `<div class="text-[11px] font-bold p-3 bg-blue-50 rounded-xl mb-1 flex justify-between items-center shadow-sm"><span>${s.paymentMethod === 'mercadopago'?'📱':'💵'} 🍭 ${s.name} (x${s.qty})</span><strong class="text-blue-700">$${s.total.toLocaleString()}</strong></div>`);
    }
}

// -----------------------------------------------------------------
// 9. RECURRENCIA
// -----------------------------------------------------------------

function openRecurringModal() {
    if (recurringToggle && recurringToggle.checked) {
        renderRecurringModal();
        if(recurringModal) recurringModal.classList.add('is-open');
    }
}

function renderRecurringModal() {
    if(!recurringMonthList) return;
    recurringMonthList.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const btn = document.createElement('button');
        btn.className = 'month-toggle-btn';
        btn.dataset.month = d.getMonth(); btn.dataset.year = d.getFullYear();
        btn.textContent = d.toLocaleString('es-AR', { month: 'short', year: 'numeric' });
        btn.onclick = (e) => e.currentTarget.classList.toggle('selected');
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
    if(recurringSummary) {
        recurringSummary.textContent = `Ciclo activo: Cada ${WEEKDAYS_ES[recurringSettings.dayOfWeek]} seleccionado.`;
        recurringSummary.classList.remove('is-hidden');
    }
    if(recurringModal) recurringModal.classList.remove('is-open');
}

// -----------------------------------------------------------------
// 10. KIOSCO (LÓGICA DE ÚLTIMO PRECIO)
// -----------------------------------------------------------------

async function handleConfirmRestock(e) {
    e.preventDefault(); 
    const id = document.getElementById('restock-prod-id').value;
    const addQ = parseInt(document.getElementById('restock-qty').value);
    const bCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    const nUnitCost = bCost / addQ;
    const p = allProducts.find(x => x.id === id);
    const uStock = p.stock + addQ;
    const uSale = Math.ceil(nUnitCost * 1.40);

    try {
        showMessage("Sincronizando costos globales...");
        await updateDoc(doc(db, productsCollectionPath, id), { 
            stock: uStock, 
            unitCost: nUnitCost, 
            salePrice: uSale 
        });
        await logKioscoTransaction(id, `Reposición (+${addQ} un.)`, addQ, nUnitCost, 'in');
        closeModals(); showMessage("Stock actualizado."); setTimeout(hideMessage, 2000);
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
            name: n, stock: s, unitCost: uc, salePrice: sp, createdAt: Timestamp.now(), adminCreator: userEmail
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
        d.className = 'product-card bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4';
        d.innerHTML = `<div class="flex justify-between items-start">
                         <div><h4 class="font-black italic uppercase text-gray-800 text-xl tracking-tighter">${p.name}</h4><span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} text-[9px] font-black uppercase">En Stock: ${p.stock}</span></div>
                         <div class="text-right"><p class="text-[8px] font-bold text-gray-400">Venta</p><p class="text-3xl font-black text-emerald-600 italic leading-none">$${p.salePrice}</p></div>
                       </div>
                       <div class="grid grid-cols-2 gap-2 mt-2">
                           <button class="p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-[10px] uppercase shadow-sm" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                           <button class="p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-[10px] uppercase shadow-sm" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                           <button class="p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-[10px] uppercase shadow-sm" onclick="window.openEditProduct('${p.id}')">✏️ FICHA</button>
                           <button class="p-3 bg-red-50 text-red-500 rounded-xl font-bold text-[10px] uppercase shadow-sm" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
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
        const i = document.createElement('div'); i.className = 'p-5 bg-gray-50 rounded-2xl flex justify-between cursor-pointer mb-2 hover:bg-emerald-50 transition-all shadow-sm';
        i.innerHTML = `<div><span class="font-black text-gray-800">${p.name}</span><p class="text-[10px] text-gray-400 font-bold uppercase">DISPONIBLE: ${p.stock}</p></div><strong class="text-emerald-700 text-xl font-black italic italic">$${p.salePrice}</strong>`;
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

async function handleConfirmSale() {
    const qEl = document.getElementById('sale-qty-input'); if(!qEl) return;
    const q = parseInt(qEl.value);
    const method = document.querySelector('input[name="salePaymentMethod"]:checked')?.value || 'efectivo';
    try {
        showMessage("Registrando cobro...");
        await addDoc(collection(db, salesCollectionPath), { 
            name: currentSelectedProduct.name, qty: q, total: q * currentSelectedProduct.salePrice, 
            paymentMethod: method, day: new Date().toISOString().split('T')[0], 
            monthYear: new Date().toISOString().substring(0, 7), timestamp: Timestamp.now(),
            adminId: userId, adminEmail: userEmail
        });
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - q });
        await logKioscoTransaction(currentSelectedProduct.id, `Venta (${method})`, q, currentSelectedProduct.unitCost, 'out');
        closeModals(); showMessage("¡Operación Exitosa!"); setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

async function logKioscoTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, transactionsCollectionPath), { productId, desc, qty, cost, type, timestamp: Timestamp.now(), adminEmail: userEmail });
}

// -----------------------------------------------------------------
// 11. GLOBALIZACIÓN WINDOW
// -----------------------------------------------------------------

window.viewBookingDetail = async (id) => {
    const b = allMonthBookings.find(x => x.id === id);
    const det = document.getElementById('view-booking-details');
    if(det) {
        det.innerHTML = `
        <h3 class="text-4xl font-black italic uppercase text-emerald-900 tracking-tighter mb-8">${b.teamName}</h3>
        <div class="space-y-4 font-bold text-sm text-gray-500">
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Categoría</span> <span class="text-gray-900">${b.type}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Día</span> <span class="text-gray-900">${b.day}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Horario</span> <span class="text-gray-900">${b.courtHours.join(', ')}hs</span></div>
            <div class="flex justify-between pt-8 items-center"><span class="text-emerald-900 uppercase font-black text-xs">Total Liquidado</span> <span class="text-4xl font-black text-emerald-600 italic tracking-tighter">$${b.totalPrice.toLocaleString()}</span></div>
        </div>`;
    }
    if(viewModal) viewModal.classList.add('is-open');
};

window.editBooking = (id) => { const b = allMonthBookings.find(x => x.id === id); closeModals(); if(b.type === 'court') showBookingModal(b.day, b); else showEventModal(b.day, b); };
window.deleteBooking = (id) => { deleteBookingIdInput.value = id; deleteReasonText.value = ''; closeModals(); if(deleteReasonModal) deleteReasonModal.classList.add('is-open'); };
window.openRestock = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('restock-prod-id').value = id; document.getElementById('restock-name').textContent = p.name; document.getElementById('restock-current-stock').textContent = p.stock; document.getElementById('restock-modal').classList.add('is-open'); };
window.deleteProduct = async (id) => { if(confirm("¿Borrar ficha?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

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
    const idVal = document.getElementById('edit-prod-id').value;
    const d = { 
        name: document.getElementById('edit-prod-name').value, 
        unitCost: parseFloat(document.getElementById('edit-prod-cost').value), 
        salePrice: parseFloat(document.getElementById('edit-prod-price').value), 
        stock: parseInt(document.getElementById('edit-prod-stock').value) 
    };
    await updateDoc(doc(db, productsCollectionPath, idVal), d);
    closeModals();
}

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); if(!list) return; list.innerHTML = '';
    s.forEach(doc => {
        const t = doc.data();
        list.innerHTML += `<div class="p-4 bg-gray-50 rounded-2xl mb-2 flex justify-between items-center shadow-sm relative overflow-hidden">
                           <div class="absolute top-0 left-0 w-1 h-full ${t.type==='in'?'bg-emerald-500':'bg-red-500'}"></div>
                           <div><p class="font-black text-sm text-gray-800 italic uppercase tracking-tighter">${t.desc}</p><p class="text-[9px] uppercase font-bold text-gray-300 italic">${t.timestamp.toDate().toLocaleString('es-AR')}</p></div>
                           <strong class="${t.type==='in'?'text-emerald-600':'text-red-500'} text-xl font-black italic">${t.type==='in'?'+':'-'}${t.qty}</strong>
                        </div>`;
    });
    document.getElementById('product-history-modal').classList.add('is-open');
};

// -----------------------------------------------------------------
// 12. UTILIDADES Y RECUENTOS
// -----------------------------------------------------------------

function showMessage(msg, isError = false) { 
    const t = document.getElementById('message-text'); 
    if(t) t.textContent = msg; 
    if(t) t.className = isError ? 'text-2xl font-black text-red-600 tracking-tighter italic uppercase' : 'text-2xl font-black text-emerald-800 tracking-tighter italic uppercase';
    messageOverlay?.classList.add('is-open'); 
}

function hideMessage() { messageOverlay?.classList.remove('is-open'); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }
function prevMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); }
function nextMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); }

function updateTotalPrice() {
    const h = courtHoursList?.querySelectorAll('.time-slot.selected').length || 0;
    const p = parseFloat(costPerHourInput?.value) || 0;
    const g = (rentGrillCheckbox && rentGrillCheckbox.checked) ? (parseFloat(grillCostInput.value) || 0) : 0;
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
        const st = {}; snap.forEach(d => { const b = d.data(), n = b.teamName ? b.teamName.toLowerCase() : "sin nombre"; if(!st[n]) st[n] = {n: b.teamName || "SIN NOMBRE", c:0, t:0}; st[n].c++; st[n].t += b.totalPrice; });
        statsList.innerHTML = ''; Object.values(st).sort((a,b)=>b.c-a.c).forEach(c => {
            statsList.innerHTML += `<div class="data-card p-6 flex justify-between items-center mb-3 border-l-8 border-emerald-400 uppercase italic"><div><strong class="font-black text-gray-800">${c.n}</strong><p class="text-[9px] font-black text-gray-400 tracking-widest">${c.c} reservas registradas</p></div><strong class="text-emerald-600 text-xl font-black italic italic">$${c.t.toLocaleString()}</strong></div>`;
        });
    } catch(e) {}
}

async function loadHistorialData() {
    if(!db) return; try {
        const snap = await getDocs(query(collection(db, logCollectionPath), orderBy("timestamp", "desc")));
        historialList.innerHTML = ''; snap.forEach(d => { const e = d.data();
            historialList.innerHTML += `<div class="data-card p-5 mb-3 flex justify-between items-start"><div><strong class="font-black italic uppercase tracking-tighter text-gray-800">${e.teamName || "EVENTO"}</strong><p class="text-[9px] mt-2 text-gray-400 font-bold uppercase tracking-widest">${e.timestamp.toDate().toLocaleString('es-AR')} | ADMIN: ${e.loggedBy || "SISTEMA"}</p></div><span class="text-[8px] font-black uppercase px-2 py-1 bg-gray-100 rounded-lg">${e.action}</span></div>`;
        });
    } catch(e) {}
}

async function handleTeamNameInput() {
    if(!teamNameInput) return; const qText = teamNameInput.value.trim().toLowerCase(); if(qText.length < 2) { teamNameSuggestions.style.display = 'none'; return; }
    try {
        const q = query(collection(db, customersCollectionPath), where(documentId(), ">=", qText), where(documentId(), "<=", qText + '\uf8ff'));
        const snap = await getDocs(q); teamNameSuggestions.innerHTML = '';
        if(snap.empty) { teamNameSuggestions.style.display = 'none'; return; }
        snap.forEach(d => { const n = d.data().name, i = document.createElement('div'); i.className = 'suggestion-item font-black text-sm p-4 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 italic uppercase italic tracking-tighter'; i.textContent = n;
            i.onmousedown = () => { teamNameInput.value = n; teamNameSuggestions.style.display = 'none'; }; teamNameSuggestions.appendChild(i);
        }); teamNameSuggestions.style.display = 'block';
    } catch (e) {}
}

async function saveCustomer(name) { if(!name) return; try { await setDoc(doc(db, customersCollectionPath, name.trim().toLowerCase()), { name: name.trim(), lastBooked: new Date().toISOString() }, { merge: true }); } catch(e) {} }

window.hideMessage = hideMessage; window.closeModals = closeModals;
console.log("Cerebro v2026 Pro - Versión 100% Sin Omisiones Cargada.");
