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
    writeBatch // Para guardado en lote
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
                syncProducts();
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
            }
        });
    } catch (error) {
        console.error("Error crítico en Firebase Init:", error);
        showMessage(`Error de Conexión: ${error.message}`, true);
    }
}

function setupEventListeners() {
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
    
    document.getElementById('prev-month-btn').onclick = prevMonth;
    document.getElementById('next-month-btn').onclick = nextMonth;
    
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

    recurringToggle.onchange = openRecurringModal;
    
    document.getElementById('cancel-recurring-btn').onclick = () => {
        recurringModal.classList.remove('is-open');
        recurringToggle.checked = false;
        recurringSummary.classList.add('is-hidden');
        recurringSummary.textContent = '';
        recurringSettings = { dayOfWeek: null, months: [] };
    };
    
    document.getElementById('confirm-recurring-btn').onclick = saveRecurringSettings;
    
    recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => {
        btn.onclick = (e) => selectRecurringDay(e.target);
    });

    const addProd = document.getElementById('add-product-btn');
    if (addProd) addProd.onclick = () => document.getElementById('product-form-container').classList.toggle('is-hidden');
    
    const cancelProd = document.getElementById('cancel-product-btn');
    if (cancelProd) cancelProd.onclick = () => document.getElementById('product-form-container').classList.add('is-hidden');

    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = calculateProductPrices;
    });

    document.getElementById('header-sale-btn').onclick = openSaleModal;
    if (saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    document.getElementById('sale-qty-minus').onclick = () => updateSaleQty(-1);
    document.getElementById('sale-qty-plus').onclick = () => updateSaleQty(1);
    if (confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;

    if (restockForm) restockForm.onsubmit = handleConfirmRestock;
    const editProdF = document.getElementById('edit-product-form');
    if (editProdF) editProdF.onsubmit = handleConfirmEditProduct;

    [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal, recurringModal, saleModal, document.getElementById('restock-modal'), document.getElementById('edit-product-modal'), document.getElementById('product-history-modal')].forEach(modal => {
        if(modal) { 
            modal.onclick = (e) => {
                if (e.target === modal) closeModals();
            };
        }
    });
}

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
        else if (viewName === 'productos') syncProducts();
    }
}

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
        console.error(error);
    }
}

async function loadAppSettings() {
    try {
        const docRef = doc(db, settingsDocPath);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appSettings = docSnap.data();
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

async function logBookingEvent(action, bookingData, reason = null) {
    try {
        const logData = { ...bookingData, action, timestamp: Timestamp.now(), loggedByEmail: userEmail };
        delete logData.id; 
        if (action === 'deleted' && reason) logData.reason = reason;
        await addDoc(collection(db, logCollectionPath), logData);
    } catch (error) { console.error(error); }
}

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
    }, (error) => { hideMessage(); });
}

async function handleSaveBooking(event) {
    event.preventDefault();
    if (recurringToggle.checked && recurringSettings.dayOfWeek !== null && recurringSettings.months.length > 0) {
        await handleSaveRecurringBooking(event);
    } else {
        await handleSaveSingleBooking(event);
    }
}

async function handleSaveSingleBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Cancha...");
    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();
    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    if (selectedCourtHours.length === 0) {
        showMessage("Debes seleccionar horarios.", true);
        setTimeout(hideMessage, 2000); saveButton.disabled = false; return;
    }
    const bookingDataBase = {
        type: 'court', teamName, courtId: document.querySelector('input[name="courtSelection"]:checked').value, peopleCount: parseInt(document.getElementById('peopleCount').value, 10), costPerHour: parseFloat(costPerHourInput.value), rentGrill: rentGrillCheckbox.checked, grillCost: parseFloat(grillCostInput.value), day: dateStr, monthYear: dateStr.substring(0, 7), paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value, courtHours: selectedCourtHours, grillHours: rentGrillCheckbox.checked ? Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10)) : [], totalPrice: updateTotalPrice() 
    };
    try {
        if (bookingId) { await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingDataBase, { merge: true }); await logBookingEvent('updated', { id: bookingId, ...bookingDataBase }); }
        else { const docR = await addDoc(collection(db, bookingsCollectionPath), bookingDataBase); await logBookingEvent('created', { id: docR.id, ...bookingDataBase }); }
        await saveCustomer(teamName); showMessage("¡Guardado!", false); closeModals(); setTimeout(hideMessage, 1500);
    } catch (error) { showMessage(error.message, true); } finally { saveButton.disabled = false; }
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
        const dim = new Date(y, mon + 1, 0).getDate();
        for (let d = 1; d <= dim; d++) {
            const date = new Date(y, mon, d);
            if (date.getDay() == dayOfWeek) datesToBook.push(date.toISOString().split('T')[0]);
        }
    });
    try {
        const batch = writeBatch(db);
        datesToBook.forEach(d => {
            const docRef = doc(collection(db, bookingsCollectionPath));
            const data = { type: 'court', teamName, courtId, day: d, monthYear: d.substring(0, 7), courtHours: selectedHours, totalPrice: updateTotalPrice(), paymentMethod: 'efectivo', timestamp: Timestamp.now() };
            batch.set(docRef, data);
        });
        await batch.commit();
        showMessage(`Creadas ${datesToBook.length} reservas.`);
        closeModals(); setTimeout(hideMessage, 2000);
    } catch (error) { showMessage(error.message, true); } finally { saveButton.disabled = false; }
}

async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    showMessage("Guardando Evento...");
    const selectedEventHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    if (selectedEventHours.length === 0) { showMessage("Selecciona horarios.", true); setTimeout(hideMessage, 2000); saveButton.disabled = false; return; }
    const eventDataBase = {
        type: 'event', teamName: eventNameInput.value.trim(), contactPerson: contactPersonInput.value.trim(), contactPhone: contactPhoneInput.value.trim(), costPerHour: parseFloat(eventCostPerHourInput.value), day: eventDateInput.value, monthYear: eventDateInput.value.substring(0, 7), paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked').value, courtHours: selectedEventHours, totalPrice: updateEventTotalPrice()
    };
    try {
        const docRef = await addDoc(collection(db, bookingsCollectionPath), eventDataBase);
        await logBookingEvent('created', { id: docRef.id, ...eventDataBase });
        showMessage("¡Evento Guardado!", false); closeModals(); setTimeout(hideMessage, 1500);
    } catch (error) { showMessage(error.message, true); } finally { saveButton.disabled = false; }
}

async function handleConfirmDelete(event) {
    event.preventDefault();
    const bookingId = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();
    if (!reason) return;
    showMessage("Eliminando...");
    try {
        const bookingRef = doc(db, bookingsCollectionPath, bookingId);
        const snap = await getDoc(bookingRef);
        if (snap.exists()) await logBookingEvent('deleted', { id: snap.id, ...snap.data() }, reason);
        await deleteDoc(bookingRef);
        closeModals(); showMessage("¡Eliminada!", false); setTimeout(hideMessage, 1500); 
    } catch (error) { showMessage(error.message, true); }
}

async function saveCustomer(name) {
    if (!name) return;
    try {
        const customerId = name.trim().toLowerCase();
        await setDoc(doc(db, customersCollectionPath, customerId), { name: name.trim(), lastBooked: new Date().toISOString() }, { merge: true });
    } catch (error) {}
}

async function handleTeamNameInput() {
    const queryText = teamNameInput.value.trim().toLowerCase();
    if (queryText.length < 2) { teamNameSuggestions.style.display = 'none'; return; }
    try {
        const q = query(collection(db, customersCollectionPath), where(documentId(), ">=", queryText), where(documentId(), "<=", queryText + '\uf8ff'));
        const snapshot = await getDocs(q);
        renderSuggestions(snapshot.docs.map(doc => doc.data().name));
    } catch (error) {}
}

function renderSuggestions(suggestions) {
    teamNameSuggestions.innerHTML = '';
    if (suggestions.length === 0) { teamNameSuggestions.style.display = 'none'; return; }
    suggestions.forEach(name => {
        const item = document.createElement('div');
        item.className = 'suggestion-item'; item.textContent = name;
        item.onmousedown = () => { teamNameInput.value = name; teamNameSuggestions.style.display = 'none'; };
        teamNameSuggestions.appendChild(item);
    });
    teamNameSuggestions.style.display = 'block';
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentMonthDate.getFullYear(), month = currentMonthDate.getMonth();
    currentMonthYearEl.textContent = `${monthNames[month]} ${year}`;
    const fd = new Date(year, month, 1).getDay(), dim = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < fd; i++) calendarGrid.appendChild(Object.assign(document.createElement('div'), { className: 'other-month-day rounded-xl h-20 md:h-28' }));
    for (let i = 1; i <= dim; i++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dbk = allMonthBookings.filter(b => b.day === ds);
        const cell = document.createElement('div');
        cell.className = `day-cell h-20 md:h-28 border border-gray-200 p-2 bg-white cursor-pointer relative rounded-xl`;
        cell.innerHTML = `<span class="text-xs font-black text-gray-400">${i}</span>`;
        if (dbk.length > 0) {
            const hasEv = dbk.some(b => b.type === 'event');
            if (hasEv) cell.classList.add('day-cell-locked');
            const badge = document.createElement('span');
            badge.className = `booking-count ${hasEv ? 'event' : ''}`;
            badge.textContent = dbk.length; cell.appendChild(badge);
        }
        cell.onclick = () => dbk.length > 0 ? showOptionsModal(ds, dbk) : (typeModal.dataset.date = ds, typeModal.classList.add('is-open'));
        calendarGrid.appendChild(cell);
    }
}

function showOptionsModal(dateStr, dayBookings) {
    optionsModal.dataset.date = dateStr;
    const listEl = document.getElementById('daily-bookings-list'); listEl.innerHTML = '';
    const hasEvent = dayBookings.some(b => b.type === 'event');
    document.getElementById('add-new-booking-btn').style.display = hasEvent ? 'none' : 'block';
    dayBookings.forEach(booking => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center p-3 bg-gray-50 border rounded-xl shadow-sm';
        item.innerHTML = `<div><p class="font-bold text-sm text-gray-800">${booking.type === 'event' ? '[E] ' + booking.teamName : booking.teamName}</p></div>
                          <div class="flex gap-1">
                              <button class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold" onclick="window.viewBookingDetail('${booking.id}')">VER</button>
                              <button class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold" onclick="window.editBooking('${booking.id}')">EDIT</button>
                              <button class="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold" onclick="window.deleteBooking('${booking.id}')">X</button>
                          </div>`;
        listEl.appendChild(item);
    });
    optionsModal.classList.add('is-open');
}

// --- LÓGICA DE CAJA (CORREGIDA) ---
async function loadCajaData() {
    if (!db) return;
    showMessage("Cargando caja...");
    const from = cajaDateFrom.value, to = cajaDateTo.value;
    if (!from || !to) { hideMessage(); return; }
    try {
        const qB = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const qS = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const [snapB, snapS] = await Promise.all([getDocs(qB), getDocs(qS)]);
        let totalB = 0, totalS = 0; const daily = {};
        snapB.docs.forEach(d => { const b = d.data(); totalB += (b.totalPrice || 0); const day = b.day; if (!daily[day]) daily[day] = { total: 0, bookings: [], sales: [] }; daily[day].total += (b.totalPrice || 0); daily[day].bookings.push(b); });
        snapS.docs.forEach(d => { const s = d.data(); totalS += (s.total || 0); const day = s.day; if (!daily[day]) daily[day] = { total: 0, bookings: [], sales: [] }; daily[day].total += (s.total || 0); daily[day].sales.push(s); });
        cajaTotalBookings.textContent = `$${totalB.toLocaleString('es-AR')}`;
        cajaTotalSales.textContent = `$${totalS.toLocaleString('es-AR')}`;
        cajaTotalCombined.textContent = `$${(totalB + totalS).toLocaleString('es-AR')}`;
        renderCajaList(daily); hideMessage();
    } catch (error) { hideMessage(); }
}

function renderCajaList(daily) {
    cajaDailyList.innerHTML = '';
    Object.keys(daily).sort((a,b) => b.localeCompare(a)).forEach(day => {
        const d = daily[day], [y, m, dn] = day.split('-');
        const item = document.createElement('div'); item.className = 'data-card p-4 flex justify-between items-center cursor-pointer mb-2';
        item.innerHTML = `<div class="flex items-center"><div class="data-card-icon bg-emerald-100 mr-4">🍭</div><div><strong class="font-black text-gray-800">${dn}/${m}/${y}</strong></div></div><strong class="text-emerald-600">$${d.total.toLocaleString()}</strong>`;
        item.onclick = () => showCajaDetail(`${dn}/${m}/${y}`, d); cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(date, data) {
    cajaDetailModal.classList.add('is-open'); document.getElementById('caja-detail-title').textContent = date;
    let bSum = data.bookings.reduce((a, b) => a + (b.totalPrice || 0), 0), sSum = data.sales.reduce((a, s) => a + (s.total || 0), 0);
    document.getElementById('caja-detail-summary').innerHTML = `<div class="flex justify-between"><span>Turnos:</span> <strong>$${bSum.toLocaleString()}</strong></div><div class="flex justify-between"><span>Kiosco:</span> <strong>$${sSum.toLocaleString()}</strong></div><div class="flex justify-between text-lg font-black border-t pt-2"><span>TOTAL:</span> <strong>$${data.total.toLocaleString()}</strong></div>`;
    const l = document.getElementById('caja-detail-booking-list'); l.innerHTML = '';
    data.bookings.forEach(b => l.innerHTML += `<div class="flex justify-between text-xs p-1"><span>📅 ${b.teamName}</span><strong>$${(b.totalPrice||0).toLocaleString()}</strong></div>`);
    data.sales.forEach(s => l.innerHTML += `<div class="flex justify-between text-xs p-1"><span>🍭 ${s.name}</span><strong>$${(s.total||0).toLocaleString()}</strong></div>`);
}

// --- LOGICA RECURRENTE ---
function openRecurringModal() {
    if (recurringToggle.checked) { renderRecurringModal(); recurringModal.classList.add('is-open'); }
}
function renderRecurringModal() {
    recurringMonthList.innerHTML = ''; const today = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const btn = document.createElement('button'); btn.className = 'month-toggle-btn'; btn.dataset.month = d.getMonth(); btn.dataset.year = d.getFullYear();
        btn.textContent = d.toLocaleString('es-AR', { month: 'short', year: 'numeric' }); btn.onclick = (e) => e.target.classList.toggle('selected');
        recurringMonthList.appendChild(btn);
    }
}
function selectRecurringDay(btn) { recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }
function saveRecurringSettings() {
    const dBtn = recurringDayGrid.querySelector('.day-toggle-btn.selected'), mBtns = recurringMonthList.querySelectorAll('.month-toggle-btn.selected');
    if (!dBtn || mBtns.length === 0) return alert("Selecciona día y meses.");
    recurringSettings.dayOfWeek = parseInt(dBtn.dataset.day, 10);
    recurringSettings.months = Array.from(mBtns).map(b => ({ month: b.dataset.month, year: b.dataset.year, name: b.textContent }));
    recurringSummary.textContent = `Ciclo: cada ${WEEKDAYS_ES[recurringSettings.dayOfWeek]} seleccionado.`;
    recurringSummary.classList.remove('is-hidden'); recurringModal.classList.remove('is-open');
}

// --- LOGICA KIOSCO (REPOSICIÓN DIRECTA) ---
async function handleConfirmRestock(e) {
    e.preventDefault(); const id = document.getElementById('restock-prod-id').value, addQ = parseInt(document.getElementById('restock-qty').value), bCost = parseFloat(document.getElementById('restock-batch-cost').value);
    const nUnit = bCost / addQ, p = allProducts.find(x => x.id === id), uStock = p.stock + addQ, uSale = Math.ceil(nUnit * (p.salePrice / p.unitCost));
    try {
        showMessage("Sincronizando precios...");
        await updateDoc(doc(db, productsCollectionPath, id), { stock: uStock, unitCost: nUnit, salePrice: uSale });
        await logKioscoTransaction(id, `Repuesto (+${addQ})`, addQ, nUnit, 'in');
        closeModals(); showMessage("Stock y costos actualizados."); setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

async function logKioscoTransaction(productId, desc, qty, cost, type) { await addDoc(collection(db, transactionsCollectionPath), { productId, desc, qty, cost, type, timestamp: Timestamp.now() }); }
function calculateProductPrices() {
    const c = parseFloat(document.getElementById('prod-batch-cost').value) || 0, q = parseInt(document.getElementById('prod-batch-qty').value) || 1, p = parseFloat(document.getElementById('prod-profit-pct').value) || 40;
    const u = c / q, s = Math.ceil(u * (1 + (p / 100)));
    document.getElementById('prod-suggested-price').textContent = `$${s}`; document.getElementById('prod-unit-cost').value = u;
}

async function handleSaveProduct(e) {
    e.preventDefault(); const n = document.getElementById('prod-name').value.trim(), s = parseInt(document.getElementById('prod-stock').value), uc = parseFloat(document.getElementById('prod-unit-cost').value), sp = parseFloat(document.getElementById('prod-suggested-price').textContent.replace('$', ''));
    try { const r = await addDoc(collection(db, productsCollectionPath), { name: n, stock: s, unitCost: uc, salePrice: sp, createdAt: Timestamp.now() }); await logKioscoTransaction(r.id, 'Alta Inicial', s, uc, 'in'); e.target.reset(); document.getElementById('product-form-container').classList.add('is-hidden'); showMessage("Guardado."); setTimeout(hideMessage, 1500); } catch (err) {}
}

function syncProducts() { onSnapshot(collection(db, productsCollectionPath), (snap) => { allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderProducts(inventorySearchInput?.value || ""); }); }
function renderProducts(f = "") {
    productList.innerHTML = ''; allProducts.filter(p => p.name.toLowerCase().includes(f.toLowerCase())).forEach(p => {
        const d = document.createElement('div'); d.className = 'product-card bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4';
        d.innerHTML = `<div class="flex justify-between items-start"><div><h4 class="font-black italic uppercase">${p.name}</h4><span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} text-[10px]">Stock: ${p.stock}</span></div><div class="text-right"><p class="text-[9px] font-bold text-gray-400">VENTA</p><p class="text-2xl font-black text-emerald-600">$${p.salePrice}</p></div></div>
                       <div class="grid grid-cols-2 gap-2 mt-2">
                           <button class="p-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs" onclick="window.openRestock('${p.id}')">REPONER</button>
                           <button class="p-2 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openHistory('${p.id}')">LOGS</button>
                           <button class="p-2 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openEditProduct('${p.id}')">EDITAR</button>
                           <button class="p-2 bg-red-50 text-red-500 rounded-xl font-bold text-xs" onclick="window.deleteProduct('${p.id}')">X</button>
                       </div>`;
        productList.appendChild(d);
    });
}

function openSaleModal() { saleSearchInput.value = ''; saleSearchResults.innerHTML = ''; selectedProductInfo.classList.add('is-hidden'); confirmSaleBtn.disabled = true; saleModal.classList.add('is-open'); setTimeout(() => saleSearchInput.focus(), 100); }
function handleSaleSearch() {
    const v = saleSearchInput.value.toLowerCase(); if (v.length < 2) { saleSearchResults.innerHTML = ''; return; }
    saleSearchResults.innerHTML = ''; allProducts.filter(p => p.name.toLowerCase().includes(v)).forEach(p => {
        const i = document.createElement('div'); i.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer mb-2';
        i.innerHTML = `<div><span class="font-black">${p.name}</span><p class="text-[10px] text-gray-400">STOCK: ${p.stock}</p></div><strong>$${p.salePrice}</strong>`;
        i.onclick = () => { currentSelectedProduct = p; document.getElementById('sel-prod-name').textContent = p.name; document.getElementById('sel-prod-stock').textContent = p.stock; document.getElementById('sel-prod-price').textContent = `$${p.salePrice}`; document.getElementById('sale-qty-input').value = 1; selectedProductInfo.classList.remove('is-hidden'); confirmSaleBtn.disabled = (p.stock <= 0); updateSaleTotal(); };
        saleSearchResults.appendChild(i);
    });
}
function updateSaleQty(d) { const i = document.getElementById('sale-qty-input'); let v = parseInt(i.value) + d; if (v < 1) v = 1; if (v > currentSelectedProduct.stock) v = currentSelectedProduct.stock; i.value = v; updateSaleTotal(); }
function updateSaleTotal() { const q = parseInt(document.getElementById('sale-qty-input').value); document.getElementById('sale-total-display').textContent = `$${(q * currentSelectedProduct.salePrice).toLocaleString()}`; }
async function handleConfirmSale() {
    const q = parseInt(document.getElementById('sale-qty-input').value); try {
        await addDoc(collection(db, salesCollectionPath), { name: currentSelectedProduct.name, qty: q, total: q * currentSelectedProduct.salePrice, day: new Date().toISOString().split('T')[0], monthYear: new Date().toISOString().substring(0, 7), timestamp: Timestamp.now() });
        await updateDoc(doc(db, productsCollectionPath, currentSelectedProduct.id), { stock: currentSelectedProduct.stock - q });
        await logKioscoTransaction(currentSelectedProduct.id, 'Venta', q, currentSelectedProduct.unitCost, 'out');
        closeModals(); showMessage("Cobrado."); setTimeout(hideMessage, 1500);
    } catch (err) {}
}

// --- VINCULACIONES WINDOW ---
window.viewBookingDetail = async (id) => {
    const b = allMonthBookings.find(x => x.id === id);
    document.getElementById('view-booking-details').innerHTML = `<h3 class="text-2xl font-black text-emerald-800 italic uppercase">${b.teamName || b.eventName}</h3><p class="text-sm font-bold text-gray-500 mt-4">${b.courtId || 'COMPLETO'}</p><p class="text-xl font-black text-emerald-600 mt-6">$${b.totalPrice?.toLocaleString()}</p>`;
    viewModal.classList.add('is-open');
};
window.editBooking = (id) => { const b = allMonthBookings.find(x => x.id === id); closeModals(); b.type === 'court' ? showBookingModal(b.day, b) : showEventModal(b.day, b); };
window.deleteBooking = (id) => { deleteBookingIdInput.value = id; deleteReasonText.value = ''; closeModals(); deleteReasonModal.classList.add('is-open'); };
window.deleteProduct = async (id) => { if (confirm("¿Borrar?")) await deleteDoc(doc(db, productsCollectionPath, id)); };
window.openRestock = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('restock-prod-id').value = id; document.getElementById('restock-name').textContent = p.name; document.getElementById('restock-current-stock').textContent = p.stock; document.getElementById('restock-modal').classList.add('is-open'); };
window.openEditProduct = (id) => { const p = allProducts.find(x => x.id === id); document.getElementById('edit-prod-id').value = id; document.getElementById('edit-prod-name').value = p.name; document.getElementById('edit-prod-cost').value = p.unitCost; document.getElementById('edit-prod-price').value = p.salePrice; document.getElementById('edit-prod-stock').value = p.stock; document.getElementById('edit-product-modal').classList.add('is-open'); };
async function handleConfirmEditProduct(e) { e.preventDefault(); const id = document.getElementById('edit-prod-id').value, d = { name: document.getElementById('edit-prod-name').value, unitCost: parseFloat(document.getElementById('edit-prod-cost').value), salePrice: parseFloat(document.getElementById('edit-prod-price').value), stock: parseInt(document.getElementById('edit-prod-stock').value) }; await updateDoc(doc(db, productsCollectionPath, id), d); closeModals(); }
window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id); document.getElementById('history-product-name').textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const l = document.getElementById('product-history-list'); l.innerHTML = '';
    s.forEach(d => { const t = d.data(); l.innerHTML += `<div class="p-3 bg-gray-50 rounded-xl mb-1 flex justify-between"><span>${t.desc}</span><strong class="${t.type==='in'?'text-emerald-600':'text-red-500'}">${t.type==='in'?'+':'-'}${t.qty}</strong></div>`; });
    document.getElementById('product-history-modal').classList.add('is-open');
};

// --- UTILIDADES ---
function showMessage(msg, isError = false) {
    const textEl = document.getElementById('message-text');
    const overlayEl = document.getElementById('message-overlay');
    if (textEl) {
        textEl.textContent = msg;
        textEl.className = isError ? 'text-xl font-black text-red-600 tracking-tight' : 'text-xl font-black text-emerald-800 tracking-tight';
    }
    if (overlayEl) overlayEl.classList.add('is-open');
}
function hideMessage() { document.getElementById('message-overlay').classList.remove('is-open'); }
function prevMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() - 1); loadBookingsForMonth(); }
function nextMonth() { currentMonthDate.setMonth(currentMonthDate.getMonth() + 1); loadBookingsForMonth(); }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open')); }
function updateCourtAvailability() { updateTotalPrice(); }
function updateTotalPrice() { const h = courtHoursList.querySelectorAll('.time-slot.selected').length, p = parseFloat(costPerHourInput.value) || 0, t = h * p; bookingTotal.textContent = `$${t.toLocaleString()}`; return t; }
function updateEventTotalPrice() { const h = eventHoursList.querySelectorAll('.time-slot.selected').length, p = parseFloat(eventCostPerHourInput.value) || 0, t = h * p; eventTotal.textContent = `$${t.toLocaleString()}`; return t; }

window.hideMessage = hideMessage;
window.closeModals = closeModals;

console.log("Sistema v2026 - Corrección Aplicada.");
