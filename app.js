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
// Rutas Kiosco
const productsCollectionPath = "products";
const salesCollectionPath = "sales";
const transactionsCollectionPath = "product_transactions";

// --- CONSTANTES DE LA APP ---
const OPERATING_HOURS = [
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
]; 
const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_TO_SHOW = 12; 

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

let appSettings = {
    court1Price: 5000,
    court2Price: 5000,
    grillPrice: 2000,
    eventPrice: 10000
};

let recurringSettings = {
    dayOfWeek: null, 
    months: [] 
};

// --- REFERENCIAS AL DOM ---
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
const configGrillPrice = document.getElementById('config-grill-price');
const configEventPrice = document.getElementById('config-event-price');

const recurringDayGrid = document.querySelector('.day-selector-grid');
const recurringMonthList = document.getElementById('recurring-month-list');

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
        console.error("Fallo crítico:", error);
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

// -----------------------------------------------------------------
// 2. CONFIGURACIÓN DE EVENT LISTENERS (RESISTENTE A ERRORES)
// -----------------------------------------------------------------

function setupEventListeners() {
    const safeBind = (id, evt, fn) => {
        const el = document.getElementById(id);
        if (el) el[evt] = fn;
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
        const dateStr = optionsModal.dataset.date;
        closeModals();
        showBookingModal(dateStr); 
    });

    safeBind('type-btn-court', 'onclick', () => {
        const dateStr = typeModal.dataset.date;
        closeModals();
        showBookingModal(dateStr);
    });

    safeBind('type-btn-event', 'onclick', () => {
        const dateStr = typeModal.dataset.date;
        closeModals();
        showEventModal(dateStr);
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
    if (recurringDayGrid) {
        recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => {
            btn.onclick = (e) => selectRecurringDay(e.currentTarget);
        });
    }

    // KIOSCO
    safeBind('add-product-btn', 'onclick', () => {
        const c = document.getElementById('product-form-container');
        if(c) c.classList.toggle('is-hidden');
    });
    
    safeBind('cancel-product-btn', 'onclick', () => {
        const c = document.getElementById('product-form-container');
        if(c) c.classList.add('is-hidden');
    });

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
    safeBind('edit-product-form', 'onsubmit', handleConfirmEditProduct);

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
// 3. NAVEGACIÓN
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
            // CAJA AUTOMÁTICA: Si no hay fechas, poner hoy
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
    showMessage("Autenticando...");
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
        console.error(error);
    }
}

// -----------------------------------------------------------------
// 5. CONFIGURACIÓN
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
    showMessage("Guardando tarifas...");
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
// 6. GESTIÓN DE RESERVAS
// -----------------------------------------------------------------

async function loadBookingsForMonth() {
    if (!db || !userId) return; 
    showMessage("Cargando calendario...");
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
    showMessage("Registrando turno...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();
    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedCourtHours.length === 0) {
        showMessage("Elegí al menos una hora.", true);
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
        grillHours: (rentGrillCheckbox && rentGrillCheckbox.checked) ? Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10)) : [],
        totalPrice: updateTotalPrice(),
        timestamp: Timestamp.now(),
        adminId: userId,
        adminEmail: userEmail
    };

    try {
        let action = bookingId ? 'updated' : 'created';
        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingDataBase, { merge: true });
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), bookingDataBase);
            bookingId = docRef.id;
        }
        await logBookingEvent(action, { id: bookingId, ...bookingDataBase });
        await saveCustomer(teamName); 
        showMessage("¡Reserva guardada!");
        closeModals(); 
        setTimeout(hideMessage, 1500); 
    } catch (error) {
        showMessage(`Error: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
    }
}

async function handleSaveRecurringBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Procesando ciclo...");

    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    const { dayOfWeek, months } = recurringSettings;
    let datesToBook = [];
    months.forEach(m => {
        const y = parseInt(m.year, 10), mon = parseInt(m.month, 10);
        const lastDay = new Date(y, mon + 1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(y, mon, d);
            if (date.getDay() == dayOfWeek) datesToBook.push(date.toISOString().split('T')[0]);
        }
    });

    try {
        const batch = writeBatch(db);
        for (const d of datesToBook) {
            const docRef = doc(collection(db, bookingsCollectionPath));
            const data = { 
                type: 'court', teamName, courtId, day: d, monthYear: d.substring(0, 7), 
                courtHours: selectedHours, totalPrice: updateTotalPrice(), 
                paymentMethod: 'efectivo', timestamp: Timestamp.now(), peopleCount: 10,
                costPerHour: parseFloat(costPerHourInput.value), rentGrill: false, grillCost: 0, grillHours: [],
                adminId: userId, adminEmail: userEmail
            };
            batch.set(docRef, data);
            await logBookingEvent('created-recurring', data);
        }
        await batch.commit();
        showMessage(`Se crearon ${datesToBook.length} reservas fijas.`);
        closeModals(); setTimeout(hideMessage, 2000);
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
    showMessage("Guardando Evento...");
    const bookingId = eventBookingIdInput.value;
    const dateStr = eventDateInput.value;
    const selectedEventHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedEventHours.length === 0) {
        showMessage("Elegí horarios.", true);
        saveButton.disabled = false;
        return;
    }

    const eventDataBase = {
        type: 'event', teamName: eventNameInput.value.trim(), contactPerson: contactPersonInput.value.trim(), 
        contactPhone: contactPhoneInput.value.trim(), costPerHour: parseFloat(eventCostPerHourInput.value), 
        day: dateStr, monthYear: dateStr.substring(0, 7), 
        paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked').value, 
        courtHours: selectedEventHours, totalPrice: updateEventTotalPrice(),
        timestamp: Timestamp.now(), adminId: userId, adminEmail: userEmail
    };

    try {
        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), eventDataBase, { merge: true });
        } else {
            await addDoc(collection(db, bookingsCollectionPath), eventDataBase);
        }
        showMessage("¡Evento Guardado!");
        closeModals(); setTimeout(hideMessage, 1500);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        saveButton.disabled = false;
    }
}

async function handleConfirmDelete(event) {
    event.preventDefault();
    const id = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();
    if (!reason) return alert("Escribe el motivo.");
    showMessage("Eliminando...");
    try {
        const ref = doc(db, bookingsCollectionPath, id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await logBookingEvent('deleted', { id: snap.id, ...snap.data() }, reason);
            await deleteDoc(ref);
            showMessage("Reserva eliminada.");
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
// 7. CALENDARIO
// -----------------------------------------------------------------

function renderCalendar() {
    if(!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear(), month = currentMonthDate.getMonth();
    if(currentMonthYearEl) currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(Object.assign(document.createElement('div'), { className: 'other-month-day h-20 md:h-28' }));
    }

    for (let i = 1; i <= lastDate; i++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const bks = allMonthBookings.filter(b => b.day === ds);
        const cell = document.createElement('div');
        cell.className = `day-cell h-20 md:h-28 border border-gray-200 p-2 bg-white cursor-pointer relative rounded-xl`;
        cell.innerHTML = `<span class="text-xs font-black text-gray-400">${i}</span>`;
        
        if (bks.length > 0) {
            const hasEv = bks.some(b => b.type === 'event');
            if (hasEv) cell.classList.add('day-cell-locked');
            const badge = document.createElement('span');
            badge.className = `booking-count ${hasEv ? 'event' : ''}`;
            badge.textContent = bks.length;
            cell.appendChild(badge);
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
        d.innerHTML = `<div><p class="font-bold text-sm text-gray-800 italic uppercase">${b.type === 'event' ? '[E] ' + b.teamName : b.teamName}</p></div>
                       <div class="flex gap-1">
                           <button class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold" onclick="window.viewBookingDetail('${b.id}')">VER</button>
                           <button class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold" onclick="window.editBooking('${b.id}')">EDIT</button>
                           <button class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold" onclick="window.deleteBooking('${b.id}')">X</button>
                       </div>`;
        list.appendChild(d);
    });
    optionsModal.classList.add('is-open');
}

// -----------------------------------------------------------------
// 8. GESTIÓN DE CAJA (AUTOMÁTICA Y DIFERENCIADA)
// -----------------------------------------------------------------

async function loadCajaData() {
    if (!db) return;
    const from = cajaDateFrom.value;
    const to = cajaDateTo.value;
    if (!from || !to) return;

    showMessage("Calculando balance...");
    try {
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        
        let bTotal = 0, sTotal = 0;
        const daily = {};

        snapB.docs.forEach(doc => {
            const b = doc.data(); bTotal += (b.totalPrice || 0);
            if (!daily[b.day]) daily[b.day] = { total: 0, bks: [], sls: [] };
            daily[b.day].total += (b.totalPrice || 0);
            daily[b.day].bks.push({id: doc.id, ...b});
        });

        snapS.docs.forEach(doc => {
            const s = doc.data(); sTotal += (s.total || 0);
            if (!daily[s.day]) daily[s.day] = { total: 0, bks: [], sls: [] };
            daily[s.day].total += (s.total || 0);
            daily[s.day].sls.push({id: doc.id, ...s});
        });

        if(cajaTotalBookings) cajaTotalBookings.textContent = `$${bTotal.toLocaleString('es-AR')}`;
        if(cajaTotalSales) cajaTotalSales.textContent = `$${sTotal.toLocaleString('es-AR')}`;
        if(cajaTotalCombined) cajaTotalCombined.textContent = `$${(bTotal + sTotal).toLocaleString('es-AR')}`;
        
        renderCajaList(daily);
        hideMessage();
    } catch (e) { 
        console.error(e);
        hideMessage(); 
    }
}

function renderCajaList(daily) {
    if(!cajaDailyList) return;
    cajaDailyList.innerHTML = '';
    const sortedDays = Object.keys(daily).sort((a,b) => b.localeCompare(a));
    
    if(sortedDays.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest p-8">Sin movimientos en este periodo</p>';
        return;
    }

    sortedDays.forEach(day => {
        const data = daily[day], [y, m, d] = day.split('-');
        const item = document.createElement('div');
        item.className = 'data-card p-6 flex justify-between items-center cursor-pointer mb-3 border-l-8 border-emerald-500 hover:scale-[1.02] transition-transform';
        item.innerHTML = `<div><strong class="text-gray-800 text-xl font-black italic tracking-tighter">${d}/${m}/${y}</strong><p class="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">${data.bks.length} Turnos | ${data.sls.length} Ventas</p></div><strong class="text-2xl font-black text-emerald-600 tracking-tighter italic">$${data.total.toLocaleString('es-AR')}</strong>`;
        item.onclick = () => showCajaDetail(`${d}/${m}/${y}`, data);
        cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(date, data) {
    if(!cajaDetailModal) return;
    cajaDetailModal.classList.add('is-open'); 
    const title = document.getElementById('caja-detail-title');
    if(title) title.textContent = date;
    const sumEl = document.getElementById('caja-detail-summary');
    
    let bSum = data.bks.reduce((a, b) => a + (b.totalPrice || 0), 0);
    let sSum = data.sls.reduce((a, s) => a + (s.total || 0), 0);
    
    if(sumEl) sumEl.innerHTML = `
        <div class="flex justify-between text-sm uppercase font-black text-gray-400 tracking-widest"><span>📅 Cancha:</span> <strong class="text-emerald-700">$${bSum.toLocaleString('es-AR')}</strong></div>
        <div class="flex justify-between text-sm uppercase font-black text-gray-400 tracking-widest"><span>🍭 Kiosco:</span> <strong class="text-blue-700">$${sSum.toLocaleString('es-AR')}</strong></div>
        <div class="flex justify-between text-2xl font-black italic border-t-4 border-gray-900 mt-4 pt-4 tracking-tighter text-gray-900"><span>TOTAL:</span> <strong>$${data.total.toLocaleString('es-AR')}</strong></div>`;
    
    const list = document.getElementById('caja-detail-booking-list');
    if(list) {
        list.innerHTML = '';
        data.bks.forEach(b => {
            const icon = b.paymentMethod === 'mercadopago' ? '📱' : '💵';
            list.innerHTML += `<div class="text-[11px] font-bold p-3 bg-gray-50 rounded-xl mb-1 flex justify-between items-center shadow-sm"><span>${icon} 📅 ${b.teamName}</span><strong class="text-emerald-700">$${b.totalPrice.toLocaleString()}</strong></div>`;
        });
        data.sls.forEach(s => {
            const icon = s.paymentMethod === 'mercadopago' ? '📱' : '💵';
            list.innerHTML += `<div class="text-[11px] font-bold p-3 bg-blue-50 rounded-xl mb-1 flex justify-between items-center shadow-sm"><span>${icon} 🍭 ${s.name} (x${s.qty})</span><strong class="text-blue-700">$${s.total.toLocaleString()}</strong></div>`;
        });
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
    if(!recurringDayGrid) return;
    recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function saveRecurringSettings() {
    const dBtn = recurringDayGrid ? recurringDayGrid.querySelector('.day-toggle-btn.selected') : null;
    const mBtns = recurringMonthList ? recurringMonthList.querySelectorAll('.month-toggle-btn.selected') : [];
    if (!dBtn || mBtns.length === 0) return alert("Selecciona día y meses para el ciclo.");
    recurringSettings.dayOfWeek = parseInt(dBtn.dataset.day, 10);
    recurringSettings.months = Array.from(mBtns).map(b => ({ month: b.dataset.month, year: b.dataset.year, name: b.textContent }));
    if(recurringSummary) {
        recurringSummary.textContent = `Ciclo activo: Cada ${WEEKDAYS_ES[recurringSettings.dayOfWeek]} seleccionado.`;
        recurringSummary.classList.remove('is-hidden');
    }
    if(recurringModal) recurringModal.classList.remove('is-open');
}

// -----------------------------------------------------------------
// 10. KIOSCO (REPOSICIÓN DIRECTA AL ÚLTIMO PRECIO)
// -----------------------------------------------------------------

async function handleConfirmRestock(e) {
    e.preventDefault(); 
    const id = document.getElementById('restock-prod-id').value;
    const addQ = parseInt(document.getElementById('restock-qty').value);
    const bCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    const nUnitCost = bCost / addQ;
    const p = allProducts.find(x => x.id === id);
    const uStock = p.stock + addQ;
    const uSale = Math.ceil(nUnitCost * 1.40); // Siempre 40% margen sobre último costo

    try {
        showMessage("Sincronizando costos globales...");
        await updateDoc(doc(db, productsCollectionPath, id), { 
            stock: uStock, 
            unitCost: nUnitCost, 
            salePrice: uSale 
        });
        await logKioscoTransaction(id, `Reposición (+${addQ} un.)`, addQ, nUnitCost, 'in');
        closeModals(); showMessage("¡Todo el stock actualizado!"); setTimeout(hideMessage, 2000);
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
        await logKioscoTransaction(r.id, 'Carga Inicial', s, uc, 'in');
        e.target.reset(); const fCont = document.getElementById('product-form-container');
        if(fCont) fCont.classList.add('is-hidden');
        showMessage("Producto registrado."); setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

function calculateProductPrices() {
    const costEl = document.getElementById('prod-batch-cost');
    const qtyEl = document.getElementById('prod-batch-qty');
    const marginEl = document.getElementById('prod-profit-pct');
    if(!costEl || !qtyEl || !marginEl) return;
    const c = parseFloat(costEl.value) || 0, q = parseInt(qtyEl.value) || 1, m = parseFloat(marginEl.value) || 40;
    const u = c / q;
    const s = Math.ceil(u * (1 + (m / 100)));
    const sDisp = document.getElementById('prod-suggested-price');
    if(sDisp) sDisp.textContent = `$${s}`;
    const uHidden = document.getElementById('prod-unit-cost');
    if(uHidden) uHidden.value = u;
}

function syncProducts() {
    onSnapshot(collection(db, productsCollectionPath), (snap) => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(inventorySearchInput?.value || "");
    });
}

function renderProducts(f = "") {
    if (!productList) return;
    productList.innerHTML = '';
    allProducts.filter(p => p.name.toLowerCase().includes(f.toLowerCase())).forEach(p => {
        const d = document.createElement('div');
        d.className = 'product-card bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 transition-all hover:border-emerald-300';
        d.innerHTML = `<div class="flex justify-between items-start">
                         <div><h4 class="font-black italic uppercase text-gray-800 tracking-tighter text-xl">${p.name}</h4><span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} text-[9px] font-black uppercase">Stock: ${p.stock}</span></div>
                         <div class="text-right"><p class="text-[8px] font-bold text-gray-300 uppercase">Venta</p><p class="text-3xl font-black text-emerald-600 tracking-tighter italic leading-none">$${p.salePrice}</p></div>
                       </div>
                       <div class="grid grid-cols-2 gap-2 mt-2">
                           <button class="p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" onclick="window.openRestock('${p.id}')">📦 REPOSICIÓN</button>
                           <button class="p-3 bg-gray-50 text-gray-600 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                           <button class="p-3 bg-gray-50 text-gray-600 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                           <button class="p-3 bg-red-50 text-red-500 rounded-xl font-bold text-[10px] uppercase shadow-sm active:scale-95" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
                       </div>`;
        productList.appendChild(d);
    });
}

// --- VENTA RÁPIDA KIOSCO (CON REGISTRO DE USUARIO Y PAGO) ---

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
        const i = document.createElement('div'); i.className = 'p-5 bg-gray-50 rounded-2xl flex justify-between cursor-pointer mb-2 hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-200 transition-all';
        i.innerHTML = `<div><span class="font-black text-gray-800">${p.name}</span><p class="text-[10px] text-gray-400 font-bold">STOCK: ${p.stock}</p></div><strong class="text-emerald-700 text-xl font-black italic">$${p.salePrice}</strong>`;
        i.onclick = () => {
            currentSelectedProduct = p; 
            const nEl = document.getElementById('sel-prod-name'); if(nEl) nEl.textContent = p.name;
            const sEl = document.getElementById('sel-prod-stock'); if(sEl) sEl.textContent = p.stock; 
            const pEl = document.getElementById('sel-prod-price'); if(pEl) pEl.textContent = `$${p.salePrice}`;
            const qEl = document.getElementById('sale-qty-input'); if(qEl) qEl.value = 1;
            if(selectedProductInfo) selectedProductInfo.classList.remove('is-hidden');
            if(confirmSaleBtn) confirmSaleBtn.disabled = (p.stock <= 0); 
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
    const qty = parseInt(qEl.value);
    const method = document.querySelector('input[name="salePaymentMethod"]:checked')?.value || 'efectivo';

    try {
        showMessage("Cobrando...");
        await addDoc(collection(db, salesCollectionPath), { 
            name: currentSelectedProduct.name, 
            qty, 
            total: qty * currentSelectedProduct.salePrice, 
            paymentMethod: method,
            day: new Date().toISOString().split('T')[0], 
            monthYear: new Date().toISOString().substring(0, 7), 
            timestamp: Timestamp.now(),
            adminId: userId,
            adminEmail: userEmail
        });
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - qty });
        await logKioscoTransaction(currentSelectedProduct.id, `Venta (${method})`, qty, currentSelectedProduct.unitCost, 'out');
        closeModals(); 
        showMessage("¡Operación Exitosa!"); 
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

async function logKioscoTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, transactionsCollectionPath), { 
        productId, desc, qty, cost, type, timestamp: Timestamp.now(), adminEmail: userEmail 
    });
}

// -----------------------------------------------------------------
// 11. FUNCIONES GLOBALES WINDOW
// -----------------------------------------------------------------

window.viewBookingDetail = async (id) => {
    const b = allMonthBookings.find(x => x.id === id);
    const det = document.getElementById('view-booking-details');
    if(det) {
        det.innerHTML = `
        <h3 class="text-4xl font-black text-emerald-900 italic uppercase tracking-tighter mb-8">${b.teamName || b.eventName}</h3>
        <div class="space-y-4 font-bold text-gray-500 text-sm">
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Categoría</span> <span class="text-gray-900">${b.type}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Fecha</span> <span class="text-gray-900">${b.day}</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Horario</span> <span class="text-gray-900">${b.courtHours.join(', ')}hs</span></div>
            <div class="flex justify-between border-b pb-2 uppercase tracking-widest text-[10px]"><span>Pago</span> <span class="text-gray-900 italic">${b.paymentMethod}</span></div>
            <div class="flex justify-between pt-8 items-center"><span class="text-emerald-900 uppercase font-black text-xs tracking-[0.2em]">Total Final</span> <span class="text-4xl font-black text-emerald-600 tracking-tighter italic">$${b.totalPrice.toLocaleString()}</span></div>
        </div>`;
    }
    if(viewModal) viewModal.classList.add('is-open');
};

window.editBooking = (id) => {
    const b = allMonthBookings.find(x => x.id === id); closeModals();
    b.type === 'court' ? showBookingModal(b.day, b) : showEventModal(b.day, b);
};

window.deleteBooking = (id) => {
    if(deleteBookingIdInput) deleteBookingIdInput.value = id; 
    if(deleteReasonText) deleteReasonText.value = '';
    closeModals(); if(deleteReasonModal) deleteReasonModal.classList.add('is-open');
};

window.deleteProduct = async (id) => { if (confirm("¿Borrar ficha de producto?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
    const idIn = document.getElementById('restock-prod-id'); if(idIn) idIn.value = id;
    const nameIn = document.getElementById('restock-name'); if(nameIn) nameIn.textContent = p.name;
    const stockIn = document.getElementById('restock-current-stock'); if(stockIn) stockIn.textContent = p.stock;
    const resM = document.getElementById('restock-modal'); if(resM) resM.classList.add('is-open');
};

window.openEditProduct = (id) => {
    const p = allProducts.find(x => x.id === id);
    const eid = document.getElementById('edit-prod-id'); if(eid) eid.value = id;
    const ename = document.getElementById('edit-prod-name'); if(ename) ename.value = p.name;
    const ecost = document.getElementById('edit-prod-cost'); if(ecost) ecost.value = p.unitCost;
    const eprice = document.getElementById('edit-prod-price'); if(eprice) eprice.value = p.salePrice;
    const estock = document.getElementById('edit-prod-stock'); if(estock) estock.value = p.stock;
    const emod = document.getElementById('edit-product-modal'); if(emod) emod.classList.add('is-open');
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
    const hName = document.getElementById('history-product-name'); if(hName) hName.textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); if(!list) return; list.innerHTML = '';
    s.forEach(doc => {
        const t = doc.data();
        list.innerHTML += `<div class="p-4 bg-gray-50 rounded-2xl mb-2 flex justify-between items-center border border-gray-100 shadow-sm relative overflow-hidden">
                           <div class="absolute top-0 left-0 w-1 h-full ${t.type==='in'?'bg-emerald-500':'bg-red-500'}"></div>
                           <div><p class="font-black text-sm text-gray-800 italic uppercase tracking-tighter">${t.desc}</p><p class="text-[9px] uppercase font-black text-gray-300 mt-1">${t.timestamp.toDate().toLocaleString()}</p></div>
                           <strong class="${t.type==='in'?'text-emerald-600':'text-red-500'} text-xl font-black italic">${t.type==='in'?'+':'-'}${t.qty}</strong>
                        </div>`;
    });
    const hMod = document.getElementById('product-history-modal'); if(hMod) hMod.classList.add('is-open');
};

// -----------------------------------------------------------------
// 12. UTILIDADES
// -----------------------------------------------------------------

function showMessage(msg, isError = false) {
    const textEl = document.getElementById('message-text');
    const overlayEl = document.getElementById('message-overlay');
    if (textEl) {
        textEl.textContent = msg;
        textEl.className = isError ? 'text-2xl font-black text-red-600 tracking-tighter italic uppercase' : 'text-2xl font-black text-emerald-800 tracking-tighter italic uppercase';
    }
    if (overlayEl) overlayEl.classList.add('is-open');
}

function hideMessage() { 
    const overlayEl = document.getElementById('message-overlay');
    if(overlayEl) overlayEl.classList.remove('is-open'); 
}

function prevMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); }
function nextMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }

function updateCourtAvailability() { updateTotalPrice(); }

function updateTotalPrice() {
    if(!courtHoursList || !costPerHourInput || !bookingTotal) return 0;
    const h = courtHoursList.querySelectorAll('.time-slot.selected').length;
    const p = parseFloat(costPerHourInput.value) || 0;
    const g = (rentGrillCheckbox && rentGrillCheckbox.checked) ? (parseFloat(grillCostInput.value) || 0) : 0;
    const t = (h * p) + g;
    bookingTotal.textContent = `$${t.toLocaleString('es-AR')}`;
    return t;
}

function updateEventTotalPrice() {
    const hList = document.getElementById('event-hours-list');
    const cIn = document.getElementById('eventCostPerHour');
    const tDisp = document.getElementById('event-total');
    if(!hList || !cIn || !tDisp) return 0;
    const h = hList.querySelectorAll('.time-slot.selected').length;
    const p = parseFloat(cIn.value) || 0;
    const t = h * p;
    tDisp.textContent = `$${t.toLocaleString('es-AR')}`;
    return t;
}

async function loadStatsData() {
    if (!db) return;
    try {
        const snap = await getDocs(collection(db, bookingsCollectionPath));
        const st = {};
        snap.forEach(doc => {
            const b = doc.data(); const n = b.teamName ? b.teamName.toLowerCase() : "consumidor final";
            if (!st[n]) st[n] = { name: b.teamName || "SIN NOMBRE", count: 0, total: 0 };
            st[n].count++; st[n].total += (b.totalPrice || 0);
        });
        const l = document.getElementById('stats-list'); if(!l) return; l.innerHTML = '';
        Object.values(st).sort((a,b) => b.count - a.count).forEach(c => {
            l.innerHTML += `<div class="data-card p-6 flex justify-between items-center mb-3 border-l-8 border-emerald-400"><div><strong class="font-black italic uppercase text-gray-800">${c.name}</strong><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">${c.count} turnos registrados</p></div><strong class="text-2xl font-black text-emerald-600 italic tracking-tighter">$${c.total.toLocaleString()}</strong></div>`;
        });
    } catch (e) {}
}

async function loadHistorialData() {
    if (!db) return;
    try {
        const snap = await getDocs(query(collection(db, logCollectionPath), orderBy("timestamp", "desc")));
        const l = document.getElementById('historial-list'); if(!l) return; l.innerHTML = '';
        snap.forEach(doc => {
            const e = doc.data();
            l.innerHTML += `<div class="data-card p-5 mb-3"><div class="flex justify-between items-start"><strong class="font-black italic uppercase tracking-tighter text-gray-800">${e.teamName || "EVENTO"}</strong><span class="text-[9px] font-black uppercase px-3 py-1 bg-gray-100 rounded-xl">${e.action}</span></div><p class="text-[9px] mt-2 text-gray-400 font-bold uppercase tracking-widest">${e.timestamp.toDate().toLocaleString('es-AR')} | ADMIN: ${e.loggedBy || "SISTEMA"}</p></div>`;
        });
    } catch (e) {}
}

async function handleTeamNameInput() {
    if(!teamNameInput || !teamNameSuggestions) return;
    const qText = teamNameInput.value.trim().toLowerCase();
    if (qText.length < 2) { teamNameSuggestions.style.display = 'none'; return; }
    try {
        const q = query(collection(db, customersCollectionPath), where(documentId(), ">=", qText), where(documentId(), "<=", qText + '\uf8ff'));
        const snap = await getDocs(q);
        teamNameSuggestions.innerHTML = '';
        if (snap.empty) { teamNameSuggestions.style.display = 'none'; return; }
        snap.forEach(doc => {
            const n = doc.data().name; const i = document.createElement('div'); i.className = 'suggestion-item font-black text-sm p-4 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-gray-50 uppercase italic tracking-tighter'; i.textContent = n;
            i.onmousedown = () => { teamNameInput.value = n; teamNameSuggestions.style.display = 'none'; };
            teamNameSuggestions.appendChild(i);
        });
        teamNameSuggestions.style.display = 'block';
    } catch (e) {}
}

window.hideMessage = hideMessage;
window.closeModals = closeModals;

console.log("Cerebro v2026 - Arqueo Automático y Gestión Pro lista.");
