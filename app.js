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
    deleteDoc, 
    collection, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    documentId,
    Timestamp, 
    orderBy, 
    getDoc 
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
const configCollectionPath = "config"; // ¡NUEVO!

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

// ¡NUEVO! Configuración de precios por defecto
let appConfig = {
    cancha1: 5000,
    cancha2: 5000,
    parrilla: 2000,
    evento: 10000
};
let configDocRef; // Referencia al documento de config en Firestore

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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
    config: document.getElementById('config-view') // ¡NUEVO!
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
const cajaTotal = document.getElementById('caja-total');
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
// Referencias de Configuración (¡NUEVO!)
const configForm = document.getElementById('config-form');
const configCancha1 = document.getElementById('config-cancha1');
const configCancha2 = document.getElementById('config-cancha2');
const configParrilla = document.getElementById('config-parrilla');
const configEvento = document.getElementById('config-evento');

// Referencias de Modales
const typeModal = document.getElementById('type-modal'); 
const bookingModal = document.getElementById('booking-modal');
const eventModal = document.getElementById('event-modal'); 
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const cajaDetailModal = document.getElementById('caja-detail-modal');
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
        
        // ¡NUEVO! Referencia al doc de config
        configDocRef = doc(db, configCollectionPath, "prices");

        await setPersistence(auth, browserLocalPersistence); 

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Usuario autenticado:", user.email);
                userId = user.uid;
                userEmail = user.email;
                appContainer.classList.remove('is-hidden');
                loginView.classList.add('is-hidden');
                registerView.classList.add('is-hidden');
                userEmailDisplay.textContent = userEmail;
                
                await loadAppConfig(); // Cargar precios
                await loadBookingsForMonth(); // Cargar reservas
                
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
    configForm.onsubmit = handleSaveConfig; // ¡NUEVO!
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
    [typeModal, bookingModal, eventModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal].forEach(modal => {
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
    if (views[viewName]) {
        views[viewName].classList.remove('is-hidden');
        if (viewName === 'caja') loadCajaData();
        else if (viewName === 'stats') loadStatsData();
        else if (viewName === 'historial') loadHistorialData();
        else if (viewName === 'config') populateConfigForm(); // ¡NUEVO!
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


// --- LÓGICA DE CONFIGURACIÓN (¡NUEVA!) ---

/**
 * Carga la configuración de precios desde Firestore al iniciar.
 */
async function loadAppConfig() {
    try {
        const docSnap = await getDoc(configDocRef);
        if (docSnap.exists()) {
            // Combina los defaults con lo guardado, por si falta algún campo
            appConfig = { ...appConfig, ...docSnap.data() };
            console.log("Configuración de precios cargada:", appConfig);
        } else {
            console.log("No se encontró config, usando defaults. Se creará al guardar.");
            // Opcional: guardar los defaults la primera vez
            await setDoc(configDocRef, appConfig);
        }
    } catch (e) {
        console.error("Error cargando config:", e);
        // Usar defaults si falla
    }
    // Llenar el formulario de config por si el usuario navega allí
    populateConfigForm();
}

/**
 * Llena el formulario de Configuración con los valores actuales.
 */
function populateConfigForm() {
    configCancha1.value = appConfig.cancha1;
    configCancha2.value = appConfig.cancha2;
    configParrilla.value = appConfig.parrilla;
    configEvento.value = appConfig.evento;
}

/**
 * Guarda los nuevos precios en Firestore.
 */
async function handleSaveConfig(e) {
    e.preventDefault();
    showMessage("Guardando configuración...");
    
    const newConfig = {
        cancha1: parseFloat(configCancha1.value),
        cancha2: parseFloat(configCancha2.value),
        parrilla: parseFloat(configParrilla.value),
        evento: parseFloat(configEvento.value)
    };
    
    try {
        await setDoc(configDocRef, newConfig);
        appConfig = newConfig; // Actualizar config global
        showMessage("¡Configuración Guardada!", false);
    } catch (error) {
        console.error("Error guardando config:", error);
        showMessage(`Error: ${error.message}`, true);
    } finally {
        setTimeout(hideMessage, 1500);
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
    if (currentBookingsUnsubscribe) return; // Ya está escuchando
    
    showMessage("Cargando reservas...");
    
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
        document.getElementById('booking-modal-title').textContent = `Reservar Cancha (${dateStr})`;
        document.getElementById('booking-id').value = '';
        // ¡ACTUALIZADO! Usar precios de config
        costPerHourInput.value = appConfig.cancha1; 
        grillCostInput.value = appConfig.parrilla;
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

/**
 * (¡ACTUALIZADO!)
 * Actualiza la grilla de disponibilidad Y el precio al cambiar el radio button.
 */
function updateCourtAvailability() {
    const dateStr = document.getElementById('booking-date').value;
    const bookingIdToEdit = bookingForm.dataset.editingId;
    const selectedCourt = document.querySelector('input[name="courtSelection"]:checked').value;
    
    const currentlySelectedHours = getCurrentlySelectedHours(courtHoursList);
    
    const occupiedCourtHours = new Set();
    allMonthBookings.filter(
        b => b.day === dateStr &&
             b.id !== bookingIdToEdit &&
             b.type === 'court' &&
             b.courtId === selectedCourt // ¡LA CLAVE!
    ).forEach(booking => booking.courtHours.forEach(hour => occupiedCourtHours.add(hour)));

    // ¡NUEVO! Actualizar el precio al cambiar la cancha
    // Solo si NO estamos editando (si editamos, mantenemos el precio guardado)
    if (!bookingIdToEdit) {
         costPerHourInput.value = (selectedCourt === 'cancha1') ? appConfig.cancha1 : appConfig.cancha2;
    }

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
        eventCostPerHourInput.value = eventToEdit.costPerHour; // Usar precio guardado
        const paymentMethod = eventToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="eventPaymentMethod"][value="${paymentMethod}"]`).checked = true;
        selectedHours = eventToEdit.courtHours || []; 
    } else {
        document.getElementById('event-modal-title').textContent = `Reservar Evento (${dateStr})`;
        eventBookingIdInput.value = '';
        eventCostPerHourInput.value = appConfig.evento; // ¡ACTUALIZADO! Usar precio de config
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
            <button class="btn-view px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md">Ver</button>
            <button class="btn-edit px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md">Editar</button>
            <button class="btn-delete px-3 py-1 text-xs bg-red-100 text-red-800 rounded-md">Eliminar</button>
        `;
        buttonsEl.querySelector('.btn-view').onclick = () => showViewModal(booking);
        buttonsEl.querySelector('.btn-edit').onclick = () => showBookingModal(dateStr, booking); 
        buttonsEl.querySelector('.btn-delete').onclick = () => handleDeleteBooking(booking.id); 
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
        <button class="btn-view px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-md">Ver</button>
        <button class="btn-edit px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-md">Editar</button>
        <button class="btn-delete px-3 py-1 text-xs bg-red-100 text-red-800 rounded-md">Eliminar</button>
    `;
    buttonsEl.querySelector('.btn-view').onclick = () => showViewModal(eventObject);
    buttonsEl.querySelector('.btn-edit').onclick = () => showEventModal(eventObject.day, eventObject); 
    buttonsEl.querySelector('.btn-delete').onclick = () => handleDeleteBooking(eventObject.id); 
    
    itemEl.appendChild(buttonsEl);
    listEl.appendChild(itemEl);

    document.getElementById('add-new-booking-btn').style.display = 'none';

    optionsModal.classList.add('is-open');
}

/**
 * (¡REDISEÑADO!)
 * Muestra el detalle de la reserva (CANCHA O EVENTO) con un look moderno.
 */
function showViewModal(booking) {
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const totalFinal = booking.totalPrice || 0;
    const courtHoursStr = booking.courtHours?.map(h => `${h}:00`).join(', ') || 'N/A';
    
    let html = '';
    
    if (booking.type === 'event') {
        // --- VISTA DE EVENTO ---
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
        // --- VISTA DE CANCHA ---
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
}


// --- LÓGICA DE NAVEGACIÓN (CALENDARIO) ---
function prevMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    loadBookingsForMonth();
