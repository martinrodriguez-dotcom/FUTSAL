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
// Nuevas rutas Kiosco
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
let allProducts = []; // Estado Kiosco
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
const statsDateFrom = document.getElementById('stats-date-from');
const statsDateTo = document.getElementById('stats-date-to');
const statsFilterBtn = document.getElementById('stats-filter-btn');
// Referencias de Historial
const historialList = document.getElementById('historial-list');
const historialDateFrom = document.getElementById('historial-date-from');
const historialDateTo = document.getElementById('historial-date-to');
const historialFilterBtn = document.getElementById('historial-filter-btn');
// Referencias de Modales
const typeModal = document.getElementById('type-modal'); 
const bookingModal = document.getElementById('booking-modal');
const eventModal = document.getElementById('event-modal'); 
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const cajaDetailModal = document.getElementById('caja-detail-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); 
const recurringModal = document.getElementById('recurring-modal'); 
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
const recurringToggle = document.getElementById('recurring-toggle'); 
const recurringSummary = document.getElementById('recurring-summary'); 
// Referencias de Formulario Evento
const eventForm = document.getElementById('event-form');
const eventBookingIdInput = document.getElementById('event-booking-id'); 
const eventDateInput = document.getElementById('event-date'); 
const eventNameInput = document.getElementById('eventName');
const contactPersonInput = document.getElementById('contactPerson');
const contactPhoneInput = document.getElementById('contactPhone');
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

// Referencias de Modal Recurrente
const recurringDayGrid = document.querySelector('.day-selector-grid');
const recurringMonthList = document.getElementById('recurring-month-list');

// Referencias Kiosco (¡NUEVAS!)
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
                syncProducts(); // Iniciar motor de Kiosco
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

    // --- LOGICA RECURRENTE ---
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

    // --- LOGICA KIOSCO (NUEVA) ---
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.onclick = () => {
            document.getElementById('product-form-container').classList.toggle('is-hidden');
        };
    }
    const cancelProductBtn = document.getElementById('cancel-product-btn');
    if (cancelProductBtn) {
        cancelProductBtn.onclick = () => {
            document.getElementById('product-form-container').classList.add('is-hidden');
        };
    }

    if (productForm) productForm.onsubmit = handleSaveProduct;
    if (inventorySearchInput) inventorySearchInput.oninput = (e) => renderProducts(e.target.value);
    
    // Cálculo automático mientras se escribe en el alta de productos
    ['prod-batch-cost', 'prod-batch-qty', 'prod-profit-pct'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = calculateProductPrices;
    });

    // Venta Rápida
    const headerSaleBtn = document.getElementById('header-sale-btn');
    if (headerSaleBtn) headerSaleBtn.onclick = openSaleModal;
    if (saleSearchInput) saleSearchInput.oninput = handleSaleSearch;
    
    const qtyMinus = document.getElementById('sale-qty-minus');
    if (qtyMinus) qtyMinus.onclick = () => updateSaleQty(-1);
    const qtyPlus = document.getElementById('sale-qty-plus');
    if (qtyPlus) qtyPlus.onclick = () => updateSaleQty(1);
    
    if (confirmSaleBtn) confirmSaleBtn.onclick = handleConfirmSale;
    const closeSaleBtn = document.getElementById('close-sale-modal-btn');
    if (closeSaleBtn) closeSaleBtn.onclick = closeModals;

    // Reposición y Edición
    if (restockForm) restockForm.onsubmit = handleConfirmRestock;
    const editProductForm = document.getElementById('edit-product-form');
    if (editProductForm) editProductForm.onsubmit = handleConfirmEditProduct;

    // Cierre de modales genérico
    [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal, recurringModal, saleModal, document.getElementById('restock-modal'), document.getElementById('edit-product-modal'), document.getElementById('product-history-modal')].forEach(modal => {
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
    } else {
        console.warn(`Vista "${viewName}" no encontrada.`);
    }
}

// --- LÓGICA DE AUTENTICACIÓN ---

async function handleLogin(e) {
    e.preventDefault();
    showMessage("Ingresando...");
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        hideMessage();
    } catch (error) {
        console.error("Error de login:", error.code, error.message);
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
        console.error("Error de registro:", error.code, error.message);
        showMessage(`Error: ${error.message}`, true);
        setTimeout(hideMessage, 3000);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Usuario cerró sesión");
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
            console.log("Configuración de precios cargada desde Firestore.");
            appSettings = docSnap.data();
        } else {
            console.warn("No se encontró config de precios. Creando una nueva...");
            await setDoc(docRef, appSettings); 
        }
    } catch (error) {
        console.error("Error al cargar la configuración de precios:", error);
    }
}

function loadConfigDataIntoForm() {
    if (!configCourt1Price) {
        console.warn("Formulario de configuración no encontrado en el HTML.");
        return;
    }
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
        const docRef = doc(db, settingsDocPath);
        await setDoc(docRef, newSettings);
        
        appSettings = newSettings;
        
        showMessage("¡Precios actualizados!", false);
        setTimeout(hideMessage, 1500);

    } catch (error) {
        console.error("Error al guardar configuración:", error);
        showMessage(`Error: ${error.message}`, true);
    }
}


// --- LÓGICA DE FIREBASE (LOGGING) ---

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
        console.log(`Evento '${action}' (${logData.type}) registrado por ${userEmail}.`);
        
    } catch (error) {
        console.error("Error al registrar evento en historial:", error);
    }
}


// --- LÓGICA DE FIREBASE (RESERVAS) ---

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
        console.error("Error al obtener reservas (onSnapshot):", error);
        if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
             console.warn("Permiso denegado. Probablemente el usuario cerró sesión.");
        } else {
             showMessage(`Error al cargar datos: ${error.message}`, true);
        }
    });
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
    saveButton.textContent = "Guardando...";
    showMessage("Guardando Cancha...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();

    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    const selectedGrillHours = Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedCourtHours.length === 0) {
        showMessage("Debes seleccionar al menos un horario de cancha.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
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
        let finalBookingDataForLog; 

        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingDataBase, { merge: true });
            action = 'updated';
            finalBookingDataForLog = { id: bookingId, ...bookingDataBase }; 
            console.log("Reserva (cancha) actualizada:", bookingId);
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), bookingDataBase);
            action = 'created';
            finalBookingDataForLog = { id: docRef.id, ...bookingDataBase }; 
            console.log("Reserva (cancha) creada:", docRef.id);
        }
        
        await logBookingEvent(action, finalBookingDataForLog);
        await saveCustomer(teamName); 
        
        showMessage("¡Reserva Guardada!", false);
        closeModals(); 
        setTimeout(hideMessage, 1500); 

    } catch (error) {
        console.error("Error al guardar reserva (cancha):", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
    }
}

async function handleSaveRecurringBooking(event) {
    const saveButton = bookingForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = "Guardando...";
    showMessage("Procesando reservas recurrentes...");

    const teamName = document.getElementById('teamName').value.trim();
    const courtId = document.querySelector('input[name="courtSelection"]:checked').value;
    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    const selectedGrillHours = Array.from(grillHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));

    if (selectedCourtHours.length === 0) {
        showMessage("Debes seleccionar al menos un horario de cancha.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
        return;
    }

    const commonBookingData = {
        type: 'court', 
        teamName: teamName,
        courtId: courtId, 
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked,
        grillCost: parseFloat(grillCostInput.value),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        courtHours: selectedCourtHours,
        grillHours: rentGrillCheckbox.checked ? selectedGrillHours : [],
        totalPrice: updateTotalPrice()
    };
    
    const { dayOfWeek, months } = recurringSettings;
    let datesToBook = [];
    
    months.forEach(m => {
        const year = parseInt(m.year, 10);
        const month = parseInt(m.month, 10);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (date.getDay() == dayOfWeek) { 
                const dateStr = date.toISOString().split('T')[0];
                datesToBook.push(dateStr);
            }
        }
    });

    if (datesToBook.length === 0) {
        showMessage("No se encontraron fechas válidas para la recurrencia.", true);
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
        return;
    }

    const conflicts = [];
    const bookingsToCreate = [];
    
    showMessage(`Comprobando ${datesToBook.length} fechas...`);
    
    const q = query(collection(db, bookingsCollectionPath), 
        where("type", "==", "court"),
        where("courtId", "==", courtId),
        where("day", ">=", datesToBook[0]) 
    );
    const snapshot = await getDocs(q);
    
    const occupiedSlotsMap = new Map();
    snapshot.docs.forEach(doc => {
        const booking = doc.data();
        const existingSlots = occupiedSlotsMap.get(booking.day) || new Set();
        booking.courtHours.forEach(hour => existingSlots.add(hour));
        occupiedSlotsMap.set(booking.day, existingSlots);
    });

    for (const dateStr of datesToBook) {
        const occupiedOnThisDate = occupiedSlotsMap.get(dateStr) || new Set();
        const hasConflict = selectedCourtHours.some(hour => occupiedOnThisDate.has(hour));
        
        if (hasConflict) {
            conflicts.push(dateStr);
        } else {
            bookingsToCreate.push({
                ...commonBookingData,
                day: dateStr,
                monthYear: dateStr.substring(0, 7)
            });
        }
    }

    try {
        if (bookingsToCreate.length > 0) {
            const batch = writeBatch(db);
            const logBatch = []; 
            
            for (const bookingData of bookingsToCreate) {
                const docRef = doc(collection(db, bookingsCollectionPath)); 
                batch.set(docRef, bookingData);
                logBatch.push(logBookingEvent('created', bookingData));
            }
            
            await batch.commit(); 
            await Promise.all(logBatch); 
        }

        let successMsg = `Se crearon ${bookingsToCreate.length} reservas.`;
        if (conflicts.length > 0) {
            successMsg += `\n${conflicts.length} fechas omitidas por conflictos: ${conflicts.join(', ')}`;
            showMessage(successMsg, true); 
        } else {
            showMessage(successMsg, false); 
        }
        
        await saveCustomer(commonBookingData.teamName); 
        closeModals(); 
        setTimeout(hideMessage, 4000); 

    } catch (error) {
        console.error("Error al guardar reservas recurrentes:", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Guardar";
    }
}


async function handleSaveEvent(event) {
    event.preventDefault();
    const saveButton = eventForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = "Guardando...";
    showMessage("Guardando Evento...");

    const bookingId = eventBookingIdInput.value; 
    const dateStr = eventDateInput.value;

    const selectedEventHours = Array.from(eventHoursList.querySelectorAll('.time-slot.selected')).map(el => parseInt(el.dataset.hour, 10));
    
    if (selectedEventHours.length === 0) {
        showMessage("Debes seleccionar al menos un horario para el evento.", true);
        setTimeout(hideMessage, 2000); 
        saveButton.disabled = false; 
        saveButton.textContent = "Guardar Evento";
        return;
    }

    const eventDataBase = {
        type: 'event', 
        teamName: eventNameInput.value.trim(), 
        contactPerson: contactPersonInput.value.trim(),
        contactPhone: contactPhoneInput.value.trim(),
        costPerHour: parseFloat(eventCostPerHourInput.value), 
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="eventPaymentMethod"]:checked').value,
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
        let finalBookingDataForLog; 

        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), eventDataBase, { merge: true });
            action = 'updated';
            finalBookingDataForLog = { id: bookingId, ...eventDataBase };
            console.log("Reserva (evento) actualizada:", bookingId);
        } else {
            const docRef = await addDoc(collection(db, bookingsCollectionPath), eventDataBase);
            action = 'created';
            finalBookingDataForLog = { id: docRef.id, ...eventDataBase };
            console.log("Reserva (evento) creada:", docRef.id);
        }
        
        await logBookingEvent(action, finalBookingDataForLog);
        await saveCustomer(eventDataBase.teamName); 
        
        showMessage("¡Evento Guardado!", false);
        closeModals();
        setTimeout(hideMessage, 1500);
        
    } catch (error) {
        console.error("Error al guardar reserva (evento):", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Guardar Evento";
    }
}

function handleDeleteBooking(bookingId) {
    closeModals(); 
    deleteBookingIdInput.value = bookingId; 
    deleteReasonText.value = ''; 
    deleteReasonModal.classList.add('is-open'); 
    console.log("Solicitando motivo para eliminar:", bookingId);
}


async function handleConfirmDelete(event) {
    event.preventDefault();
    const bookingId = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();

    if (!bookingId) return;
    if (!reason) {
        alert("Por favor, ingresa un motivo para eliminar."); 
        return;
    }

    showMessage("Eliminando...");

    try {
        const bookingRef = doc(db, bookingsCollectionPath, bookingId);
        const bookingSnapshot = await getDoc(bookingRef); 
        
        let bookingDataToLog = null;
        if (bookingSnapshot.exists()) { 
             bookingDataToLog = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
        } else {
            bookingDataToLog = allMonthBookings.find(b => b.id === bookingId);
            if (!bookingDataToLog) throw new Error("No se encontró la reserva para registrar.");
        }

        await logBookingEvent('deleted', bookingDataToLog, reason);
        await deleteDoc(bookingRef);
        console.log("Reserva eliminada:", bookingId);

        closeModals();
        showMessage("¡Reserva Eliminada!", false); 
        setTimeout(hideMessage, 1500); 

    } catch (error) {
        console.error("Error al confirmar eliminación:", error);
        showMessage(`Error al eliminar: ${error.message}`, true);
        closeModals(); 
    }
}


// --- LÓGICA DE FIREBASE (CLIENTES) ---
async function saveCustomer(name) {
    if (!name) return;
    try {
        const customerId = name.trim().toLowerCase();
        if (!customerId) return; 
        const docRef = doc(db, customersCollectionPath, customerId);
        await setDoc(docRef, { 
            name: name.trim(),
            lastBooked: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error("Error al guardar cliente:", error);
    }
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
    } catch (error) {
        console.error("Error al buscar clientes:", error);
    }
}

function renderSuggestions(suggestions) {
    teamNameSuggestions.innerHTML = '';
    if (suggestions.length === 0) {
        teamNameSuggestions.style.display = 'none';
        return;
    }
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
        if (!bookingsByDay[day]) {
            bookingsByDay[day] = { court: 0, event: 0 };
        }
        if (booking.type === 'event') {
            bookingsByDay[day].event++;
        } else {
            bookingsByDay[day].court++;
        }
    });

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.appendChild(createDayCell(daysInPrevMonth - firstDayOfMonth + 1 + i, false));
    for (let i = 1; i <= daysInMonth; i++) {
        const dayData = bookingsByDay[i] || { court: 0, event: 0 };
        calendarGrid.appendChild(createDayCell(i, true, dayData.court, dayData.event));
    }
    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) calendarGrid.appendChild(createDayCell(i, false));
}

function createDayCell(dayNum, isCurrentMonth, courtCount = 0, eventCount = 0) {
    const dayCell = document.createElement('div');
    dayCell.className = `relative h-20 md:h-28 border border-gray-200 p-2 shadow-sm transition-all duration-200 day-cell`;
    
    if (isCurrentMonth) {
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        dayCell.dataset.date = dateStr;
        dayCell.onclick = () => handleDayClick(dateStr);

        if (eventCount > 0) {
            dayCell.classList.add('day-cell-locked');
            dayCell.innerHTML = `<span class="text-sm font-medium text-amber-800">${dayNum}</span>`;
            const countBadge = document.createElement('span');
            countBadge.textContent = eventCount;
            countBadge.className = 'booking-count event'; 
            dayCell.appendChild(countBadge);
        } else if (courtCount > 0) {
            dayCell.classList.add('bg-white', 'cursor-pointer');
            dayCell.innerHTML = `<span class="text-sm font-medium text-gray-700">${dayNum}</span>`;
            const countBadge = document.createElement('span');
            countBadge.textContent = courtCount;
            countBadge.className = 'booking-count'; 
            dayCell.appendChild(countBadge);
        } else {
            dayCell.classList.add('bg-white', 'cursor-pointer');
            dayCell.innerHTML = `<span class="text-sm font-medium text-gray-700">${dayNum}</span>`;
        }
    } else {
        dayCell.classList.add('other-month-day');
        dayCell.innerHTML = `<span class="text-sm">${dayNum}</span>`;
    }
    return dayCell;
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


// --- LÓGICA DE MODALES (RESERVAS) ---

async function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    bookingForm.reset();
    
    const bookingIdToEdit = bookingToEdit ? bookingToEdit.id : null;
    bookingForm.dataset.editingId = bookingIdToEdit || ''; 

    document.getElementById('booking-date').value = dateStr;
    document.querySelector('input[name="paymentMethod"][value="efectivo"]').checked = true;
    
    let initialCourtId = 'cancha1';
    let selectedGrillHours = [];

    if (bookingToEdit) {
        recurringToggle.disabled = true;
        document.getElementById('booking-modal-title').textContent = "Editar Reserva (Cancha)";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        costPerHourInput.value = bookingToEdit.costPerHour;
        rentGrillCheckbox.checked = bookingToEdit.rentGrill;
        grillCostInput.value = bookingToEdit.grillCost;
        initialCourtId = bookingToEdit.courtId || 'cancha1'; 
        const paymentMethod = bookingToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`).checked = true;
        selectedGrillHours = bookingToEdit.grillHours || [];
    } else {
        recurringToggle.disabled = false;
        document.getElementById('booking-modal-title').textContent = `Reservar Cancha (${dateStr})`;
        document.getElementById('booking-id').value = '';
        costPerHourInput.value = appSettings.court1Price; 
        grillCostInput.value = appSettings.grillPrice; 
        rentGrillCheckbox.checked = false;
    }

    document.querySelector(`input[name="courtSelection"][value="${initialCourtId}"]`).checked = true;

    updateCourtAvailability(); 
    
    const occupiedGrillHours = new Set();
    allMonthBookings.filter(
        b => b.day === dateStr && b.id !== bookingIdToEdit && b.rentGrill
    ).forEach(booking => booking.grillHours.forEach(hour => occupiedGrillHours.add(hour)));

    const initialGrillHours = bookingToEdit ? selectedGrillHours : getCurrentlySelectedHours(courtHoursList);
    renderTimeSlots(grillHoursList, occupiedGrillHours, initialGrillHours);
    
    grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
    updateTotalPrice();
    bookingModal.classList.add('is-open');
}

function getCurrentlySelectedHours(containerEl) {
    return Array.from(containerEl.querySelectorAll('.time-slot.selected'))
                .map(el => parseInt(el.dataset.hour, 10));
}

function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const bookingIdToEdit = bookingForm.dataset.editingId;
    const selectedCourt = document.querySelector('input[name="courtSelection"]:checked').value;
    
    if (!bookingIdToEdit) { 
        if (selectedCourt === 'cancha1') {
            costPerHourInput.value = appSettings.court1Price;
        } else {
            costPerHourInput.value = appSettings.court2Price;
        }
    }

    const currentlySelectedHours = getCurrentlySelectedHours(courtHoursList);
    
    const occupiedCourtHours = new Set();
    allMonthBookings.filter(
        b => b.day === dateStr &&
             b.id !== bookingIdToEdit &&
             b.type === 'court' &&
             b.courtId === selectedCourt
    ).forEach(booking => booking.courtHours.forEach(hour => occupiedCourtHours.add(hour)));

    renderTimeSlots(courtHoursList, occupiedCourtHours, currentlySelectedHours);
    updateTotalPrice();
}


function showEventModal(dateStr, eventToEdit = null) {
    closeModals();
    eventForm.reset();
    
    const occupiedHours = new Set(); 
    let selectedHours = [];
    
    eventDateInput.value = dateStr;
    document.querySelector('input[name="eventPaymentMethod"][value="efectivo"]').checked = true;
    
    if (eventToEdit) {
        document.getElementById('event-modal-title').textContent = `Editar Evento (${dateStr})`;
        eventBookingIdInput.value = eventToEdit.id;
        eventNameInput.value = eventToEdit.teamName; 
        contactPersonInput.value = eventToEdit.contactPerson;
        contactPhoneInput.value = eventToEdit.contactPhone;
        eventCostPerHourInput.value = eventToEdit.costPerHour; 
        const paymentMethod = eventToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="eventPaymentMethod"][value="${paymentMethod}"]`).checked = true;
        selectedHours = eventToEdit.courtHours || []; 
    } else {
        document.getElementById('event-modal-title').textContent = `Reservar Evento (${dateStr})`;
        eventBookingIdInput.value = '';
        eventCostPerHourInput.value = appSettings.eventPrice; 
    }

    renderTimeSlots(eventHoursList, occupiedHours, selectedHours);
    updateEventTotalPrice();
    eventModal.classList.add('is-open');
}


function renderTimeSlots(containerEl, occupiedHours, selectedHours) {
    containerEl.innerHTML = '';
    OPERATING_HOURS.forEach(hour => {
        const slot = document.createElement('button');
        slot.type = "button"; 
        slot.className = 'time-slot';
        slot.textContent = `${hour}:00`;
        slot.dataset.hour = hour;
        if (occupiedHours.has(hour)) {
            slot.classList.add('disabled');
            slot.disabled = true;
        } else if (selectedHours.includes(hour)) {
            slot.classList.add('selected');
        }
        if (!slot.disabled) {
            slot.onclick = (e) => {
                e.preventDefault();
                e.target.classList.toggle('selected');
                if (bookingModal.classList.contains('is-open')) {
                    updateTotalPrice();
                } else if (eventModal.classList.contains('is-open')) {
                    updateEventTotalPrice();
                }
            };
        }
        containerEl.appendChild(slot);
    });
}

function updateTotalPrice() {
    const costCancha = parseFloat(costPerHourInput.value) || 0;
    const costParrilla = parseFloat(grillCostInput.value) || 0;
    const selectedCourtHours = courtHoursList.querySelectorAll('.time-slot.selected').length;
    const selectedGrillHours = grillHoursList.querySelectorAll('.time-slot.selected').length;
    const isGrillRented = rentGrillCheckbox.checked;
    const totalCancha = selectedCourtHours * costCancha;
    const totalParrilla = isGrillRented ? (selectedGrillHours * costParrilla) : 0;
    const totalFinal = totalCancha + totalParrilla;
    bookingTotal.textContent = `$${totalFinal.toLocaleString('es-AR')}`;
    return totalFinal; 
}

function updateEventTotalPrice() {
    const costEvento = parseFloat(eventCostPerHourInput.value) || 0;
    const selectedEventHours = eventHoursList.querySelectorAll('.time-slot.selected').length;
    const totalFinal = selectedEventHours * costEvento;
    eventTotal.textContent = `$${totalFinal.toLocaleString('es-AR')}`;
    return totalFinal; 
}


function showOptionsModal(dateStr, courtBookings) {
    closeModals();
    optionsModal.dataset.date = dateStr;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = '';
    
    if (courtBookings.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay reservas de cancha para este día.</p>';
    }
    
    courtBookings.forEach(booking => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 bg-gray-50 rounded-lg border flex justify-between items-center';
        const courtName = booking.courtId === 'cancha2' ? ' (Cancha 2)' : ' (Cancha 1)';
        itemEl.innerHTML = `<span class="font-medium">${booking.teamName}${courtName}</span>`;
        
        const buttonsEl = document.createElement('div');
        buttonsEl.className = 'flex gap-2';
        buttonsEl.innerHTML = `
            <button class="btn-view px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md" onclick="window.viewBookingDetail('${booking.id}')">Ver</button>
            <button class="btn-edit px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md" onclick="window.editBooking('${booking.id}')">Editar</button>
            <button class="btn-delete px-3 py-1 text-xs bg-red-100 text-red-800 rounded-md" onclick="window.deleteBooking('${booking.id}')">Eliminar</button>
        `;
        itemEl.appendChild(buttonsEl);
        listEl.appendChild(itemEl);
    });
    
    document.getElementById('add-new-booking-btn').style.display = 'block';
    optionsModal.classList.add('is-open');
}

function showEventOptionsModal(eventObject) {
    closeModals();
    optionsModal.dataset.date = eventObject.day;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = ''; 

    const itemEl = document.createElement('div');
    itemEl.className = 'p-3 bg-amber-50 rounded-lg border border-amber-200 flex justify-between items-center';
    itemEl.innerHTML = `<span class="font-medium text-amber-800">(EVENTO) ${eventObject.teamName}</span>`;
    
    const buttonsEl = document.createElement('div');
    buttonsEl.className = 'flex gap-2';
    buttonsEl.innerHTML = `
        <button class="btn-view px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md" onclick="window.viewBookingDetail('${eventObject.id}')">Ver</button>
        <button class="btn-edit px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md" onclick="window.editBooking('${eventObject.id}')">Editar</button>
        <button class="btn-delete px-3 py-1 text-xs bg-red-100 text-red-800 rounded-md" onclick="window.deleteBooking('${eventObject.id}')">Eliminar</button>
    `;
    
    itemEl.appendChild(buttonsEl);
    listEl.appendChild(itemEl);

    document.getElementById('add-new-booking-btn').style.display = 'none';

    optionsModal.classList.add('is-open');
}

function showViewModal(booking) {
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const totalFinal = booking.totalPrice || 0;
    const courtHoursStr = booking.courtHours?.map(h => `${h}:00`).join(', ') || 'N/A';
    
    let html = '';
    
    if (booking.type === 'event') {
        html = `
            <div class="flex items-center mb-4">
                <span class="p-3 rounded-xl bg-amber-100 text-amber-600 mr-4">
                    <svg class="w-6 h-6 icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </span>
                <div>
                    <h3 class="text-2xl font-bold text-amber-700">Evento</h3>
                    <p class="text-lg text-gray-600">${booking.teamName}</p>
                </div>
            </div>
            <div class="space-y-3 text-gray-700">
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> <span>Contacto: ${booking.contactPerson || 'N/A'}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> <span>Celular: ${booking.contactPhone || 'N/A'}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span>Horas: ${courtHoursStr}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> <span>Pago: ${booking.paymentMethod || 'N/A'}</span></div>
                <hr class="my-3">
                <div class="flex items-center text-xl font-bold"><svg class="w-6 h-6 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01"></path></svg> <span>Total Pagado: $${totalFinal.toLocaleString('es-AR')}</span></div>
            </div>
        `;
    } else {
        const courtName = booking.courtId === 'cancha2' ? 'Cancha 2' : 'Cancha 1';
        const grillHoursStr = booking.rentGrill ? (booking.grillHours?.map(h => `${h}:00`).join(', ') || 'No usó') : 'No alquilada';
        
        html = `
            <div class="flex items-center mb-4">
                <span class="p-3 rounded-xl bg-emerald-100 text-emerald-600 mr-4">
                    <svg class="w-6 h-6 icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1.002c-5.514 0-10 4.02-10 8.996 0 4.975 4.486 8.995 10 8.995s10-4.02 10-8.995c0-4.976-4.486-8.996-10-8.996zm0 16.99c-4.411 0-8-3.585-8-7.995s3.589-7.996 8-7.996 8 3.585 8 7.996-3.589 7.995-8 7.995z"></path><path d="M12 6.002c-3.309 0-6 2.687-6 5.996 0 3.31 2.691 5.995 6 5.995s6-2.685 6-5.995c0-3.309-2.691-5.996-6-5.996zm0 10.99c-2.757 0-5-2.24-5-4.995s2.243-4.996 5-4.996 5 2.24 5 4.996-2.243 4.995-5 4.995z"></path><path d="M11 1.011h2v3.011h-2zM11 17.978h2v3.011h-2zM1.01 11v2h3.01v-2zM17.98 11v2h3.01v-2zM3.52 3.511l1.414 1.414 2.129-2.129-1.414-1.414zM16.93 16.921l1.414 1.414 2.129-2.129-1.414-1.414zM3.51 16.921l2.129 2.129 1.414-1.414-2.129-2.129zM16.92 3.511l2.129 2.129 1.414-1.414-2.129-2.129z"></path></svg>
                </span>
                <div>
                    <h3 class="text-2xl font-bold text-emerald-700">Reserva de Cancha</h3>
                    <p class="text-lg text-gray-600">${booking.teamName} (${courtName})</p>
                </div>
            </div>
            <div class="space-y-3 text-gray-700">
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-2.39M12 12a3 3 0 100-6 3 3 0 000 6zM6 20h2v-2a3 3 0 015.356-2.39M12 12a3 3 0 100-6 3 3 0 000 6z"></path></svg> <span>Personas: ${booking.peopleCount}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span>Horas Cancha: ${courtHoursStr}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7.657 5 12 5s5.657 2.343 5.657 2.343a8 8 0 010 11.314zM12 12v.01"></path></svg> <span>Parrilla: ${grillHoursStr}</span></div>
                <div class="flex items-center"><svg class="w-5 h-5 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> <span>Pago: ${booking.paymentMethod || 'N/A'}</span></div>
                <hr class="my-3">
                <div class="flex items-center text-xl font-bold"><svg class="w-6 h-6 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01"></path></svg> <span>Total Pagado: $${totalFinal.toLocaleString('es-AR')}</span></div>
            </div>
        `;
    }
    detailsEl.innerHTML = html;
    viewModal.classList.add('is-open');
}


function closeModals() {
    typeModal.classList.remove('is-open');
    bookingModal.classList.remove('is-open');
    eventModal.classList.remove('is-open');
    optionsModal.classList.remove('is-open');
    viewModal.classList.remove('is-open');
    cajaDetailModal.classList.remove('is-open');
    deleteReasonModal.classList.remove('is-open'); 
    recurringModal.classList.remove('is-open'); 

    recurringToggle.checked = false;
    recurringToggle.disabled = false;
    recurringSummary.classList.add('is-hidden');
    recurringSummary.textContent = '';
    recurringSettings = { dayOfWeek: null, months: [] };
    
    // Cerrar modales nuevos si existen
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
}


// --- LÓGICA DE NAVEGACIÓN (CALENDARIO) ---
function prevMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    loadBookingsForMonth();
}
function nextMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    loadBookingsForMonth();
}


// --- LÓGICA DE VISTA DE CAJA (UNIFICADA) ---
async function loadCajaData() {
    if (!db) return;
    showMessage("Cargando datos de caja...");
    const from = cajaDateFrom.value;
    const to = cajaDateTo.value;
    if (!from || !to) {
        hideMessage();
        return;
    }

    try {
        // Consultar Reservas
        const qBookings = query(collection(db, bookingsCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const snapBookings = await getDocs(qBookings);
        
        // Consultar Ventas Kiosco
        const qSales = query(collection(db, salesCollectionPath), where("day", ">=", from), where("day", "<=", to));
        const snapSales = await getDocs(qSales);
        
        let totalBookings = 0;
        let totalSales = 0;
        const dailyTotals = {};

        snapBookings.docs.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            const total = booking.totalPrice || 0;
            totalBookings += total;
            const day = booking.day;
            if (!dailyTotals[day]) dailyTotals[day] = { total: 0, bookings: [], sales: [] };
            dailyTotals[day].total += total;
            dailyTotals[day].bookings.push(booking);
        });

        snapSales.docs.forEach(doc => {
            const sale = { id: doc.id, ...doc.data() };
            const total = sale.total || 0;
            totalSales += total;
            const day = sale.day;
            if (!dailyTotals[day]) dailyTotals[day] = { total: 0, bookings: [], sales: [] };
            dailyTotals[day].total += total;
            dailyTotals[day].sales.push(sale);
        });
        
        // Actualizar UI de totales separados
        cajaTotalBookings.textContent = `$${totalBookings.toLocaleString('es-AR')}`;
        cajaTotalSales.textContent = `$${totalSales.toLocaleString('es-AR')}`;
        cajaTotalCombined.textContent = `$${(totalBookings + totalSales).toLocaleString('es-AR')}`;
        
        renderCajaList(dailyTotals);
        hideMessage();
    } catch (error) {
        console.error("Error al cargar caja:", error);
        showMessage(`Error: ${error.message}`, true);
    }
}

function renderCajaList(dailyTotals) {
    cajaDailyList.innerHTML = '';
    const sortedDays = Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a));
    if (sortedDays.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-gray-500 text-center">No hay movimientos en el rango.</p>';
        return;
    }
    sortedDays.forEach(day => {
        const data = dailyTotals[day];
        const [year, month, dayNum] = day.split('-');
        const displayDate = `${dayNum}/${month}/${year}`;
        
        const item = document.createElement('div');
        item.className = 'caja-day-item data-card p-4 flex justify-between items-center cursor-pointer'; 
        item.innerHTML = `
            <div class="flex items-center">
                <div class="data-card-icon bg-emerald-100 text-emerald-600 mr-4">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                    <strong class="font-black text-gray-800">${displayDate}</strong>
                    <div class="text-[10px] text-gray-400 font-bold uppercase">${data.bookings.length} turnos | ${data.sales.length} ventas</div>
                </div>
            </div>
            <strong class="text-xl font-black text-emerald-600">$${data.total.toLocaleString('es-AR')}</strong>
        `;
        item.onclick = () => showCajaDetail(displayDate, data);
        cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(displayDate, data) {
    cajaDetailModal.classList.add('is-open');
    document.getElementById('caja-detail-title').textContent = displayDate;
    const summaryEl = document.getElementById('caja-detail-summary');
    
    let sumBookings = data.bookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0);
    let sumSales = data.sales.reduce((acc, s) => acc + (s.total || 0), 0);

    summaryEl.innerHTML = `
        <div class="flex justify-between"><span>Recaudación Turnos:</span> <strong>$${sumBookings.toLocaleString('es-AR')}</strong></div>
        <div class="flex justify-between"><span>Ventas Kiosco:</span> <strong>$${sumSales.toLocaleString('es-AR')}</strong></div>
        <div class="flex justify-between text-lg font-black pt-4 border-t border-gray-100"><span>TOTAL DÍA:</span> <strong>$${data.total.toLocaleString('es-AR')}</strong></div>
    `;
    const listEl = document.getElementById('caja-detail-booking-list');
    listEl.innerHTML = '';
    
    // Mezclar y mostrar detalles
    data.bookings.forEach(b => {
        const item = document.createElement('div');
        item.className = 'flex justify-between text-xs p-2 bg-gray-50 rounded-lg mb-1';
        item.innerHTML = `<span>📅 ${b.teamName}</span> <strong>$${(b.totalPrice || 0).toLocaleString()}</strong>`;
        listEl.appendChild(item);
    });
    data.sales.forEach(s => {
        const item = document.createElement('div');
        item.className = 'flex justify-between text-xs p-2 bg-blue-50 rounded-lg mb-1';
        item.innerHTML = `<span>🍭 ${s.name} (x${s.qty})</span> <strong>$${(s.total || 0).toLocaleString()}</strong>`;
        listEl.appendChild(item);
    });
}


// --- LÓGICA DE VISTA DE ESTADÍSTICAS ---
async function loadStatsData() {
    if (!db) return;
    showMessage("Calculando estadísticas...");
    try {
        let q = query(collection(db, bookingsCollectionPath));
        const from = statsDateFrom.value;
        const to = statsDateTo.value;
        if (from) q = query(q, where("day", ">=", from));
        if (to) q = query(q, where("day", "<=", to));
        
        const snapshot = await getDocs(q);
        const stats = {};
        
        snapshot.docs.forEach(doc => {
            const booking = doc.data();
            const total = booking.totalPrice || 0;
            const normalizedName = booking.teamName.trim().toLowerCase();
            if (normalizedName) { 
                if (!stats[normalizedName]) {
                    stats[normalizedName] = { 
                        name: booking.teamName.trim(), 
                        count: 0, 
                        totalSpent: 0 
                    };
                }
                stats[normalizedName].count++;
                stats[normalizedName].totalSpent += total;
            }
        });
        
        renderStatsList(stats);
        hideMessage();
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        showMessage(`Error: ${error.message}.`, true);
    }
}

function renderStatsList(stats) {
    statsList.innerHTML = '';
    const statsArray = Object.values(stats);
    statsArray.sort((a, b) => b.count - a.count);
    if (statsArray.length === 0) {
        statsList.innerHTML = '<p class="text-gray-500 text-center">No hay reservas en el rango.</p>';
        return;
    }
    statsArray.forEach((client, index) => {
        const item = document.createElement('div');
        item.className = 'stats-item data-card p-4 mb-3 flex justify-between items-center'; 
        
        let iconHtml = '';
        if (index === 0) { 
            iconHtml = `<div class="data-card-icon bg-amber-100 text-amber-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg></div>`;
        } else {
            iconHtml = `<div class="data-card-icon bg-gray-100 text-gray-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>`;
        }
        
        item.innerHTML = `
            <div class="flex items-center">
                ${iconHtml}
                <div>
                    <div class="font-black text-gray-800">${client.name}</div>
                    <div class="text-xs text-gray-400 font-bold uppercase">${client.count} reserva(s)</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-black text-emerald-600 text-lg">$${client.totalSpent.toLocaleString('es-AR')}</div>
                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gastado</div>
            </div>
        `;
        statsList.appendChild(item);
    });
}

// --- LÓGICA DE VISTA DE HISTORIAL ---

async function loadHistorialData() {
    if (!db) return;
    showMessage("Cargando historial...");
    try {
        let q = query(collection(db, logCollectionPath), orderBy("timestamp", "desc")); 
        const fromDateStr = historialDateFrom.value;
        const toDateStr = historialDateTo.value;
        if (fromDateStr) {
            const fromTimestamp = Timestamp.fromDate(new Date(fromDateStr + "T00:00:00")); 
            q = query(q, where("timestamp", ">=", fromTimestamp));
        }
        if (toDateStr) {
             const toTimestamp = Timestamp.fromDate(new Date(toDateStr + "T23:59:59")); 
            q = query(q, where("timestamp", "<=", toTimestamp));
        }
        const snapshot = await getDocs(q);
        const logEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistorialList(logEntries);
        hideMessage();
    } catch (error) {
        console.error("Error al cargar historial:", error);
        showMessage(`Error al cargar historial: ${error.message}.`, true);
    }
}

function renderHistorialList(logEntries) {
    historialList.innerHTML = '';
    if (logEntries.length === 0) {
        historialList.innerHTML = '<p class="text-gray-500 text-center">No hay eventos en el rango seleccionado.</p>';
        return;
    }
    logEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'historial-item data-card p-4 mb-3'; 
        const eventDate = entry.timestamp.toDate();
        const formattedTimestamp = eventDate.toLocaleString('es-AR', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        
        let statusClass = '', statusText = '', statusIcon = '';
        switch(entry.action) {
            case 'created': 
                statusClass = entry.type === 'event' ? 'event-created' : 'created'; 
                statusText = entry.type === 'event' ? 'Evento Creado' : 'Reserva Creada';
                statusIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
                break;
            case 'updated': 
                statusClass = 'updated'; 
                statusText = entry.type === 'event' ? 'Evento Actualizado' : 'Reserva Actualizada';
                statusIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11.418 0a8.001 8.001 0 00-15.356-2H4"></path></svg>`;
                break;
            case 'deleted': 
                statusClass = 'deleted'; 
                statusText = entry.type === 'event' ? 'Evento Eliminado' : 'Reserva Eliminada';
                statusIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
                break;
            default: statusText = entry.action;
        }
        
        const courtName = entry.type === 'court' ? ` (${entry.courtId || 'C1'})` : '';
        const courtHoursStr = entry.courtHours?.map(h => `${h}:00`).join(', ') || '-';
        const total = entry.totalPrice || 0;

        item.innerHTML = `
            <div class="flex items-start">
                <div class="data-card-icon ${statusClass} mr-4">
                    ${statusIcon}
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <strong class="text-gray-800 font-black">${entry.teamName || entry.eventName}${courtName}</strong>
                            <div class="text-[10px] text-gray-400 font-bold uppercase">${formattedTimestamp}</div>
                        </div>
                        <span class="status ${statusClass} text-[10px] font-black uppercase px-2 py-1 rounded-lg">${statusText}</span>
                    </div>
                    <div class="mt-3 text-xs text-gray-600">
                        <p>Total: <strong>$${total.toLocaleString('es-AR')}</strong> | Horas: ${courtHoursStr}</p>
                        ${entry.reason ? `<div class="reason mt-2 text-red-600 font-bold">Motivo: ${entry.reason}</div>` : ''}
                        <p class="text-[9px] mt-1 text-gray-400">ADMIN: ${entry.loggedByEmail || 'Sistema'}</p>
                    </div>
                </div>
            </div>
        `;
        historialList.appendChild(item);
    });
}


// --- LÓGICA DE RECURRENCIA ---

function openRecurringModal() {
    if (recurringToggle.checked) {
        if (bookingForm.dataset.editingId) {
            showMessage("No se puede crear una reserva recurrente al editar.", true);
            recurringToggle.checked = false;
            return;
        }
        renderRecurringModal();
        recurringModal.classList.add('is-open');
    } else {
        recurringSettings = { dayOfWeek: null, months: [] };
        recurringSummary.classList.add('is-hidden');
        recurringSummary.textContent = '';
    }
}

function renderRecurringModal() {
    recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => btn.classList.remove('selected'));
    recurringMonthList.innerHTML = '';
    
    const today = new Date();
    for (let i = 0; i < MONTHS_TO_SHOW; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const month = date.getMonth();
        const year = date.getFullYear();
        const monthName = new Date(year, month).toLocaleString('es-AR', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-toggle-btn';
        btn.dataset.month = month;
        btn.dataset.year = year;
        btn.textContent = `${capitalizedMonth} ${year}`;
        
        btn.onclick = (e) => {
            e.target.classList.toggle('selected');
        };
        
        recurringMonthList.appendChild(btn);
    }
}

function selectRecurringDay(selectedButton) {
    recurringDayGrid.querySelectorAll('.day-toggle-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    selectedButton.classList.add('selected');
}

function saveRecurringSettings() {
    const selectedDayBtn = recurringDayGrid.querySelector('.day-toggle-btn.selected');
    const selectedMonthBtns = recurringMonthList.querySelectorAll('.month-toggle-btn.selected');

    if (!selectedDayBtn) {
        alert("Por favor, selecciona un día de la semana.");
        return;
    }
    if (selectedMonthBtns.length === 0) {
        alert("Por favor, selecciona al menos un mes.");
        return;
    }

    recurringSettings.dayOfWeek = parseInt(selectedDayBtn.dataset.day, 10);
    recurringSettings.months = Array.from(selectedMonthBtns).map(btn => {
        return {
            month: btn.dataset.month,
            year: btn.dataset.year,
            name: btn.textContent.split(' ')[0] 
        };
    });

    const dayName = WEEKDAYS_ES[recurringSettings.dayOfWeek];
    const monthNamesShort = recurringSettings.months.map(m => m.name.substring(0, 3)).join(', ');
    recurringSummary.textContent = `Repetir cada ${dayName} de ${monthNamesShort}.`;
    recurringSummary.classList.remove('is-hidden');
    
    recurringModal.classList.remove('is-open'); 
}


// --- LÓGICA DE KIOSCO (NUEVAS FUNCIONES) ---

/**
 * REPOSICIÓN DIRECTA: Actualiza todo el stock anterior al precio de la última compra.
 */
async function handleConfirmRestock(e) {
    e.preventDefault();
    const id = document.getElementById('restock-prod-id').value;
    const addQty = parseInt(document.getElementById('restock-qty').value);
    const batchCost = parseFloat(document.getElementById('restock-batch-cost').value);
    
    const newUnitCost = batchCost / addQty;
    const product = allProducts.find(x => x.id === id);
    const updatedStock = product.stock + addQty;
    
    // Mantener margen del 40% (o el previo)
    const margin = product.salePrice / product.unitCost;
    const updatedSalePrice = Math.ceil(newUnitCost * margin);

    try {
        showMessage("Sincronizando precios de todo el stock...");
        await updateDoc(doc(db, productsCollectionPath, id), {
            stock: updatedStock,
            unitCost: newUnitCost, // ACTUALIZACIÓN DIRECTA DE TODO EL STOCK
            salePrice: updatedSalePrice
        });

        await logKioscoTransaction(id, `Reposición (+${addQty})`, addQty, newUnitCost, 'in');
        closeModals();
        showMessage("Stock actualizado al último precio.");
        setTimeout(hideMessage, 2000);
    } catch (err) { alert(err.message); }
}

async function logKioscoTransaction(productId, desc, qty, cost, type) {
    await addDoc(collection(db, transactionsCollectionPath), {
        productId, desc, qty, cost, type, timestamp: Timestamp.now()
    });
}

function calculateProductPrices() {
    const cost = parseFloat(document.getElementById('prod-batch-cost').value) || 0;
    const qty = parseInt(document.getElementById('prod-batch-qty').value) || 1;
    const profit = parseFloat(document.getElementById('prod-profit-pct').value) || 40;
    
    const unit = cost / qty;
    const sale = Math.ceil(unit * (1 + (profit / 100)));
    
    const display = document.getElementById('prod-suggested-price');
    if (display) display.textContent = `$${sale}`;
    const hidden = document.getElementById('prod-unit-cost');
    if (hidden) hidden.value = unit;
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
        setTimeout(hideMessage, 1500);
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
        div.className = 'product-card bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex flex-col gap-4';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-black text-xl text-gray-800 leading-tight italic uppercase">${p.name}</h4>
                    <span class="stock-badge ${p.stock < 5 ? 'stock-low' : 'stock-ok'} mt-1 inline-block text-[10px] font-black uppercase">Stock: ${p.stock}</span>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Venta</p>
                    <p class="text-2xl font-black text-emerald-600 tracking-tighter">$${p.salePrice}</p>
                </div>
            </div>
            <div class="card-actions-grid grid grid-cols-2 gap-2 mt-2">
                <button class="card-action-btn p-3 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs" onclick="window.openRestock('${p.id}')">📦 REPONER</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openHistory('${p.id}')">📜 LOGS</button>
                <button class="card-action-btn p-3 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs" onclick="window.openEditProduct('${p.id}')">✏️ EDITAR</button>
                <button class="card-action-btn p-3 bg-red-50 text-red-500 rounded-xl font-bold text-xs" onclick="window.deleteProduct('${p.id}')">🗑️ BORRAR</button>
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
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between cursor-pointer hover:bg-emerald-50 mb-2 transition-all border border-transparent hover:border-emerald-200';
        item.innerHTML = `<div><span class="font-black text-gray-800">${p.name}</span><p class="text-[10px] text-gray-400 font-bold uppercase">STOCK: ${p.stock}</p></div><strong class="text-emerald-600 text-lg">$${p.salePrice}</strong>`;
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
        showMessage("¡Venta completada!", false);
        setTimeout(hideMessage, 1500);
    } catch (err) { alert(err.message); }
}

// --- VINCULACIÓN WINDOW PARA BOTONES DINÁMICOS ---

window.viewBookingDetail = async (id) => {
    const booking = allMonthBookings.find(b => b.id === id);
    const detailEl = document.getElementById('view-booking-details');
    detailEl.innerHTML = `
        <h3 class="text-3xl font-black text-emerald-800 mb-6 tracking-tighter italic uppercase">${booking.teamName || booking.eventName}</h3>
        <div class="space-y-3 text-sm font-bold text-gray-600">
            <div class="flex justify-between border-b pb-2"><span>TIPO:</span> <span class="text-gray-900">${booking.type === 'event' ? 'EVENTO' : 'TURNO'}</span></div>
            <div class="flex justify-between border-b pb-2"><span>CANCHA:</span> <span class="text-gray-900">${booking.courtId || 'COMPLETO'}</span></div>
            <div class="flex justify-between border-b pb-2"><span>HORARIO:</span> <span class="text-gray-900">${booking.courtHours.join(", ")}HS</span></div>
            <div class="flex justify-between pt-6"><span class="text-emerald-800">TOTAL PAGADO:</span> <span class="text-2xl font-black text-emerald-600">$${booking.totalPrice.toLocaleString()}</span></div>
        </div>`;
    viewModal.classList.add('is-open');
};

window.editBooking = (id) => {
    const booking = allMonthBookings.find(b => b.id === id);
    closeModals();
    if (booking.type === 'court') {
        showBookingModal(booking.day, booking);
    } else {
        showEventModal(booking.day, booking);
    }
};

window.deleteBooking = (id) => {
    deleteBookingIdInput.value = id;
    deleteReasonText.value = '';
    closeModals();
    deleteReasonModal.classList.add('is-open');
};

window.deleteProduct = async (id) => { if (confirm("¿Eliminar ficha de producto?")) await deleteDoc(doc(db, productsCollectionPath, id)); };

window.openRestock = (id) => {
    const p = allProducts.find(x => x.id === id);
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

window.openHistory = async (id) => {
    const p = allProducts.find(x => x.id === id);
    document.getElementById('history-product-name').textContent = p.name;
    const s = await getDocs(query(collection(db, transactionsCollectionPath), where("productId", "==", id), orderBy("timestamp", "desc")));
    const list = document.getElementById('product-history-list'); list.innerHTML = '';
    s.forEach(d => {
        const t = d.data();
        const date = t.timestamp.toDate().toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const item = document.createElement('div');
        item.className = 'p-4 bg-gray-50 rounded-2xl flex justify-between items-center mb-2 border border-gray-100 shadow-sm';
        item.innerHTML = `<div><p class="font-black text-gray-800 text-sm">${t.desc}</p><p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">${date}</p></div><p class="font-black ${t.type==='in'?'text-emerald-600':'text-red-500'} text-lg">${t.type==='in'?'+':'-'}${t.qty}</p>`;
        list.appendChild(item);
    });
    document.getElementById('product-history-modal').classList.add('is-open');
};

// --- UTILIDADES (MENSAJES) ---
function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-xl font-black text-red-600 tracking-tight' : 'text-xl font-black text-emerald-800 tracking-tight';
    messageOverlay.classList.add('is-open');
}
function hideMessage() {
    messageOverlay.classList.remove('is-open');
}

window.hideMessage = hideMessage;
window.closeModals = closeModals;

console.log("Sistema Panza Verde v2026 - Cargado Completo.");
