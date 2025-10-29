// Importaciones de Firebase SDK (v11.x.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
    Timestamp, // ¡NUEVO! Para guardar fechas/horas precisas
    orderBy, // ¡NUEVO! Para ordenar el historial
    getDoc // ¡NUEVO! Necesario para obtener un solo documento (en handleDelete)
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// -----------------------------------------------------------------
// 1. CONFIGURACIÓN DE FIREBASE (¡TU CONFIGURACIÓN!)
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
const logCollectionPath = "booking_log"; // ¡NUEVA COLECCIÓN!

// --- CONSTANTES DE LA APP ---
const OPERATING_HOURS = [
    9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
]; 

// --- VARIABLES GLOBALES DE LA APP ---
let db, auth, userId;
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = []; 
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- REFERENCIAS AL DOM ---
// Vistas
const views = {
    calendar: document.getElementById('calendar-view'),
    caja: document.getElementById('caja-view'),
    stats: document.getElementById('stats-view'),
    historial: document.getElementById('historial-view') // ¡NUEVO!
};

// Calendario
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');

// Menú
const menuBtn = document.getElementById('menu-btn');
const mainMenu = document.getElementById('main-menu');
const menuOverlay = document.getElementById('menu-overlay');

// Caja
const cajaDailyList = document.getElementById('caja-daily-list');
const cajaTotal = document.getElementById('caja-total');
const cajaDateFrom = document.getElementById('caja-date-from');
const cajaDateTo = document.getElementById('caja-date-to');
const cajaFilterBtn = document.getElementById('caja-filter-btn');

// Estadísticas
const statsList = document.getElementById('stats-list');
const statsDateFrom = document.getElementById('stats-date-from');
const statsDateTo = document.getElementById('stats-date-to');
const statsFilterBtn = document.getElementById('stats-filter-btn');

// Historial (¡NUEVO!)
const historialList = document.getElementById('historial-list');
const historialDateFrom = document.getElementById('historial-date-from');
const historialDateTo = document.getElementById('historial-date-to');
const historialFilterBtn = document.getElementById('historial-filter-btn');

// Modales
const bookingModal = document.getElementById('booking-modal');
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const cajaDetailModal = document.getElementById('caja-detail-modal');
const deleteReasonModal = document.getElementById('delete-reason-modal'); // ¡NUEVO!
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

// Formulario de Reserva
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

// Formulario de Razón de Eliminación (¡NUEVO!)
const deleteReasonForm = document.getElementById('delete-reason-form');
const deleteReasonText = document.getElementById('delete-reason-text');
const deleteBookingIdInput = document.getElementById('delete-booking-id');


// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando App...");
    showMessage("Iniciando conexión...");
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
                console.log("Usuario autenticado:", userId);
                await loadBookingsForMonth(); 
                hideMessage();
            } else {
                console.log("Sin usuario, intentando anónimo...");
                await signInAnonymously(auth);
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
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const viewName = e.target.dataset.view;
            showView(viewName);
            toggleMenu();
        };
    });
    
    // Calendario
    document.getElementById('prev-month-btn').onclick = prevMonth;
    document.getElementById('next-month-btn').onclick = nextMonth;
    
    // Formularios y Modales
    bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.getElementById('close-options-btn').onclick = closeModals;
    document.getElementById('close-view-btn').onclick = closeModals;
    document.getElementById('close-caja-detail-btn').onclick = closeModals;
    document.getElementById('add-new-booking-btn').onclick = () => {
        const dateStr = optionsModal.dataset.date;
        closeModals();
        showBookingModal(dateStr); 
    };

    // Filtros
    cajaFilterBtn.onclick = loadCajaData;
    statsFilterBtn.onclick = loadStatsData; 
    historialFilterBtn.onclick = loadHistorialData; // ¡NUEVO!

    // Sugerencias de Cliente
    teamNameInput.oninput = handleTeamNameInput;
    teamNameInput.onblur = () => { setTimeout(() => { teamNameSuggestions.style.display = 'none'; }, 200); };
    teamNameInput.onfocus = handleTeamNameInput;
    
    // Formulario de Reserva (Cálculo Total)
    rentGrillCheckbox.onchange = () => {
        grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
        updateTotalPrice();
    };
    costPerHourInput.oninput = updateTotalPrice;
    grillCostInput.oninput = updateTotalPrice;
    
    // Formulario Razón de Eliminación (¡NUEVO!)
    deleteReasonForm.onsubmit = handleConfirmDelete;
    document.getElementById('cancel-delete-btn').onclick = closeModals;

     // Cierre de modales genérico
    [bookingModal, optionsModal, viewModal, cajaDetailModal, deleteReasonModal].forEach(modal => {
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
        
        // Carga de datos específicos de la vista
        if (viewName === 'caja') loadCajaData();
        else if (viewName === 'stats') loadStatsData();
        else if (viewName === 'historial') loadHistorialData(); // ¡NUEVO!
    } else {
        console.warn(`Vista "${viewName}" no encontrada.`);
    }
}

// --- LÓGICA DE FIREBASE (LOGGING) ---

/**
 * Registra un evento (creación, actualización, eliminación) en el historial.
 */
async function logBookingEvent(action, bookingData, reason = null) {
    try {
        const logData = {
            ...bookingData, 
            action: action, 
            timestamp: Timestamp.now(), 
            loggedByUserId: userId // Renombramos para claridad
        };
        
        // Quitamos el ID original de la reserva del log, no es necesario aquí.
        // El log tendrá su propio ID único.
        delete logData.id; 
        
        if (action === 'deleted' && reason) {
            logData.reason = reason;
        }

        await addDoc(collection(db, logCollectionPath), logData);
        console.log(`Evento '${action}' registrado para ${bookingData.teamName} el ${bookingData.day}`);
        
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
        showMessage(`Error al cargar datos: ${error.message}`, true);
    });
}

/**
 * Guarda la reserva y registra el evento en el historial.
 */
async function handleSaveBooking(event) {
    event.preventDefault();
    showMessage("Guardando...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();

    const selectedCourtHours = Array.from(courtHoursList.querySelectorAll('.time-slot.selected'))
                                    .map(el => parseInt(el.dataset.hour, 10));
    const selectedGrillHours = Array.from(grillHoursList.querySelectorAll('.time-slot.selected'))
                                    .map(el => parseInt(el.dataset.hour, 10));

    if (selectedCourtHours.length === 0) {
        showMessage("Debes seleccionar al menos un horario de cancha.", true);
        setTimeout(hideMessage, 2000); 
        return;
    }

    // Construimos el objeto base sin ID
    const bookingDataBase = {
        teamName: teamName,
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        costPerHour: parseFloat(costPerHourInput.value),
        rentGrill: rentGrillCheckbox.checked,
        grillCost: parseFloat(grillCostInput.value),
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value,
        courtHours: selectedCourtHours,
        grillHours: rentGrillCheckbox.checked ? selectedGrillHours : []
    };

    try {
        let action = '';
        let finalBookingDataForLog; // Variable para asegurar que tenemos el ID correcto

        if (bookingId) {
            // Actualización
            await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingDataBase, { merge: true });
            action = 'updated';
            finalBookingDataForLog = { id: bookingId, ...bookingDataBase }; // Usamos el ID existente
            console.log("Reserva actualizada:", bookingId);
        } else {
            // Creación
            const docRef = await addDoc(collection(db, bookingsCollectionPath), bookingDataBase);
            action = 'created';
            finalBookingDataForLog = { id: docRef.id, ...bookingDataBase }; // Usamos el nuevo ID
            console.log("Reserva creada:", docRef.id);
        }
        
        // Registrar evento en el historial CON el ID correcto
        await logBookingEvent(action, finalBookingDataForLog);
        
        await saveCustomer(teamName); 
        closeModals();
        hideMessage(); 
    } catch (error) {
        console.error("Error al guardar reserva:", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    }
}

/**
 * Muestra el modal para pedir la razón de eliminación.
 */
function handleDeleteBooking(bookingId) {
    // Primero, busca la reserva actual para mostrarla mientras se pide la razón (opcional pero útil)
    const bookingToDelete = allMonthBookings.find(b => b.id === bookingId);
    if (!bookingToDelete) {
        console.error("No se encontró la reserva a eliminar en el caché local.");
        showMessage("Error: No se encontró la reserva.", true);
        return;
    }

    closeModals(); 
    deleteBookingIdInput.value = bookingId; 
    deleteReasonText.value = ''; 
    // Puedes añadir info de la reserva al modal si quieres:
    // document.getElementById('delete-modal-info').textContent = `Eliminando reserva de ${bookingToDelete.teamName} el ${bookingToDelete.day}`;
    deleteReasonModal.classList.add('is-open'); 
}

/**
 * Confirma la eliminación, registra en el log y borra la reserva.
 */
async function handleConfirmDelete(event) {
    event.preventDefault();
    const bookingId = deleteBookingIdInput.value;
    const reason = deleteReasonText.value.trim();

    if (!bookingId) {
        console.error("handleConfirmDelete: No se encontró bookingId.");
        return;
    }
    if (!reason) {
        // Mostramos un mensaje DENTRO del modal de eliminación
        alert("Por favor, ingresa un motivo para eliminar."); 
        return;
    }

    showMessage("Eliminando...");

    try {
        // 1. Obtener los datos de la reserva ANTES de eliminarla
        // Usamos getDoc para asegurar que tenemos los datos más recientes
        const bookingRef = doc(db, bookingsCollectionPath, bookingId);
        const bookingSnapshot = await getDoc(bookingRef); // Usar getDoc
        
        let bookingDataToLog = null;
        if (bookingSnapshot.exists()) { // Verificar si el documento existe
             bookingDataToLog = { id: bookingSnapshot.id, ...bookingSnapshot.data() };
        } else {
            // Si no existe (quizás ya se borró), intentamos buscar en el caché local como fallback
            bookingDataToLog = allMonthBookings.find(b => b.id === bookingId);
            if (!bookingDataToLog) {
                throw new Error("No se encontró la reserva para registrar en el historial.");
            }
             console.warn("Reserva no encontrada en DB para log, usando caché local.");
        }

        // 2. Registrar el evento de eliminación PRIMERO (más seguro)
        await logBookingEvent('deleted', bookingDataToLog, reason);

        // 3. Eliminar la reserva de la colección principal DESPUÉS
        await deleteDoc(bookingRef);
        console.log("Reserva eliminada:", bookingId);

        closeModals();
        hideMessage(); // onSnapshot actualizará el calendario automáticamente

    } catch (error) {
        console.error("Error al confirmar eliminación:", error);
        showMessage(`Error al eliminar: ${error.message}`, true);
        // Asegúrate de cerrar el modal incluso si hay error
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

    const bookingsCountByDay = {};
    allMonthBookings.forEach(booking => {
        const day = parseInt(booking.day.split('-')[2], 10);
        bookingsCountByDay[day] = (bookingsCountByDay[day] || 0) + 1;
    });

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) calendarGrid.appendChild(createDayCell(daysInPrevMonth - firstDayOfMonth + 1 + i, false));
    for (let i = 1; i <= daysInMonth; i++) calendarGrid.appendChild(createDayCell(i, true, bookingsCountByDay[i] || 0));
    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) calendarGrid.appendChild(createDayCell(i, false));
}
function createDayCell(dayNum, isCurrentMonth, bookingCount = 0) {
    const dayCell = document.createElement('div');
    dayCell.className = `relative h-20 md:h-28 border border-gray-200 rounded-lg p-2 shadow-sm transition-all duration-200`;
    if (isCurrentMonth) {
        const dateStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        dayCell.classList.add('bg-white', 'cursor-pointer', 'hover:bg-emerald-50');
        dayCell.dataset.date = dateStr;
        dayCell.onclick = () => handleDayClick(dateStr);
        dayCell.innerHTML = `<span class="text-sm font-medium text-gray-700">${dayNum}</span>`;
        if (bookingCount > 0) {
            const countBadge = document.createElement('span');
            countBadge.textContent = bookingCount > 9 ? '9+' : bookingCount;
            countBadge.className = 'booking-count';
            dayCell.appendChild(countBadge);
        }
    } else {
        dayCell.classList.add('other-month-day');
        dayCell.innerHTML = `<span class="text-sm">${dayNum}</span>`;
    }
    return dayCell;
}
function handleDayClick(dateStr) {
    const bookingsOnDay = allMonthBookings.filter(b => b.day === dateStr);
    if (bookingsOnDay.length === 0) {
        showBookingModal(dateStr); 
    } else {
        showOptionsModal(dateStr, bookingsOnDay);
    }
}


// --- LÓGICA DE MODALES (RESERVAS) ---
async function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    bookingForm.reset();
    
    const bookingIdToEdit = bookingToEdit ? bookingToEdit.id : null;
    
    const otherBookings = allMonthBookings.filter(
        b => b.day === dateStr && b.id !== bookingIdToEdit
    );

    const occupiedCourtHours = new Set();
    const occupiedGrillHours = new Set();

    otherBookings.forEach(booking => {
        booking.courtHours?.forEach(hour => occupiedCourtHours.add(hour));
        booking.grillHours?.forEach(hour => occupiedGrillHours.add(hour));
    });

    document.getElementById('booking-date').value = dateStr;
    document.querySelector('input[name="paymentMethod"][value="efectivo"]').checked = true;
    
    let selectedCourtHours = [];
    let selectedGrillHours = [];

    if (bookingToEdit) {
        document.getElementById('booking-modal-title').textContent = "Editar Reserva";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        costPerHourInput.value = bookingToEdit.costPerHour;
        rentGrillCheckbox.checked = bookingToEdit.rentGrill;
        grillCostInput.value = bookingToEdit.grillCost;
        const paymentMethod = bookingToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`).checked = true;
        selectedCourtHours = bookingToEdit.courtHours || [];
        selectedGrillHours = bookingToEdit.grillHours || [];
    } else {
        document.getElementById('booking-modal-title').textContent = `Reservar Turno (${dateStr})`;
        document.getElementById('booking-id').value = '';
        costPerHourInput.value = "5000";
        grillCostInput.value = "2000";
        rentGrillCheckbox.checked = false;
    }

    renderTimeSlots(courtHoursList, occupiedCourtHours, selectedCourtHours);
    renderTimeSlots(grillHoursList, occupiedGrillHours, selectedGrillHours);
    grillHoursSection.classList.toggle('is-hidden', !rentGrillCheckbox.checked);
    updateTotalPrice();
    bookingModal.classList.add('is-open');
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
                updateTotalPrice();
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
}

function showOptionsModal(dateStr, bookingsOnDay) {
    closeModals();
    optionsModal.dataset.date = dateStr;
    const listEl = document.getElementById('daily-bookings-list');
    listEl.innerHTML = '';
    if (bookingsOnDay.length === 0) listEl.innerHTML = '<p class="text-gray-500">No hay reservas para este día.</p>';
    
    bookingsOnDay.forEach(booking => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 bg-gray-50 rounded-lg border flex justify-between items-center';
        itemEl.innerHTML = `<span class="font-medium">${booking.teamName}</span>`;
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
    optionsModal.classList.add('is-open');
}

function showViewModal(booking) {
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const courtHoursCount = booking.courtHours?.length || 0;
    const grillHoursCount = booking.grillHours?.length || 0;
    const totalCancha = (booking.costPerHour || 0) * courtHoursCount;
    const totalParrilla = booking.rentGrill ? ((booking.grillCost || 0) * grillHoursCount) : 0;
    const totalFinal = totalCancha + totalParrilla;
    const courtHoursStr = booking.courtHours?.map(h => `${h}:00`).join(', ') || 'N/A';
    const grillHoursStr = booking.grillHours?.map(h => `${h}:00`).join(', ') || 'No alquilada';

    detailsEl.innerHTML = `
        <p><strong>Equipo:</strong> ${booking.teamName}</p>
        <p><strong>Personas:</strong> ${booking.peopleCount}</p>
        <p><strong>Método Pago:</strong> <span style="text-transform: capitalize;">${booking.paymentMethod || 'N/A'}</span></p>
        <hr class="my-2">
        <p><strong>Horas Cancha (${courtHoursCount}):</strong> ${courtHoursStr}</p>
        <p><strong>Horas Parrilla (${grillHoursCount}):</strong> ${grillHoursStr}</p>
        <hr class="my-2">
        <p><strong>Subtotal Cancha:</strong> $${totalCancha.toLocaleString('es-AR')}</p>
        <p><strong>Subtotal Parrilla:</strong> $${totalParrilla.toLocaleString('es-AR')}</p>
        <p class="text-lg font-bold mt-2"><strong>Total Pagado:</strong> $${totalFinal.toLocaleString('es-AR')}</p>
    `;
    viewModal.classList.add('is-open');
}

function closeModals() {
    bookingModal.classList.remove('is-open');
    optionsModal.classList.remove('is-open');
    viewModal.classList.remove('is-open');
    cajaDetailModal.classList.remove('is-open');
    deleteReasonModal.classList.remove('is-open'); 
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


// --- LÓGICA DE VISTA DE CAJA ---
async function loadCajaData() {
    if (!db) return;
    showMessage("Cargando datos de caja...");
    try {
        let q = query(collection(db, bookingsCollectionPath));
        const from = cajaDateFrom.value;
        const to = cajaDateTo.value;
        if (from) q = query(q, where("day", ">=", from));
        if (to) q = query(q, where("day", "<=", to));
        const snapshot = await getDocs(q);
        
        let grandTotal = 0;
        const dailyTotals = {};
        
        snapshot.docs.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            const total = (booking.costPerHour || 0) * (booking.courtHours?.length || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) * (booking.grillHours?.length || 0) : 0);
            grandTotal += total;
            const day = booking.day;
            const paymentMethod = booking.paymentMethod || 'efectivo';
            if (!dailyTotals[day]) {
                dailyTotals[day] = { total: 0, efectivo: 0, transferencia: 0, mercadopago: 0, bookings: [] };
            }
            dailyTotals[day].total += total;
            if (dailyTotals[day][paymentMethod] !== undefined) {
                dailyTotals[day][paymentMethod] += total;
            }
            dailyTotals[day].bookings.push(booking); 
        });
        
        cajaTotal.textContent = `$${grandTotal.toLocaleString('es-AR')}`;
        renderCajaList(dailyTotals);
        hideMessage();
    } catch (error) {
        console.error("Error al cargar datos de caja:", error);
        showMessage(`Error: ${error.message}. ¿Creaste el índice en Firestore?`, true);
    }
}

function renderCajaList(dailyTotals) {
    cajaDailyList.innerHTML = '';
    const sortedDays = Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a));
    if (sortedDays.length === 0) {
        cajaDailyList.innerHTML = '<p class="text-gray-500 text-center">No hay reservas en el rango.</p>';
        return;
    }
    sortedDays.forEach(day => {
        const data = dailyTotals[day];
        const [year, month, dayNum] = day.split('-');
        const displayDate = `${dayNum}/${month}/${year}`;
        const item = document.createElement('div');
        item.className = 'caja-day-item';
        item.innerHTML = `
            <span class="font-medium text-gray-800">${displayDate}</span>
            <strong class="text-lg text-emerald-600">$${data.total.toLocaleString('es-AR')}</strong>
        `;
        item.onclick = () => showCajaDetail(displayDate, data);
        cajaDailyList.appendChild(item);
    });
}

function showCajaDetail(displayDate, data) {
    cajaDetailModal.classList.add('is-open');
    document.getElementById('caja-detail-title').textContent = `Detalle: ${displayDate}`;
    const summaryEl = document.getElementById('caja-detail-summary');
    summaryEl.innerHTML = `
        <p class="flex justify-between"><span>Efectivo:</span> <strong>$${data.efectivo.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Transferencia:</span> <strong>$${data.transferencia.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Mercado Pago:</span> <strong>$${data.mercadopago.toLocaleString('es-AR')}</strong></p>
        <hr class="my-2">
        <p class="flex justify-between text-lg font-bold"><span>Total Día:</span> <strong>$${data.total.toLocaleString('es-AR')}</strong></p>
    `;
    const listEl = document.getElementById('caja-detail-booking-list');
    listEl.innerHTML = '';
    if (data.bookings.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay detalles de reservas.</p>';
    } else {
        data.bookings.forEach(booking => {
            const total = (booking.costPerHour || 0) * (booking.courtHours?.length || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) * (booking.grillHours?.length || 0) : 0);
            const item = document.createElement('div');
            item.className = 'caja-booking-item';
            item.innerHTML = `
                <span>${booking.teamName}</span>
                <span class="font-medium text-gray-600">$${total.toLocaleString('es-AR')} (${booking.paymentMethod})</span>
            `;
            listEl.appendChild(item);
        });
    }
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
            const total = (booking.costPerHour || 0) * (booking.courtHours?.length || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) * (booking.grillHours?.length || 0) : 0);
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
    statsArray.forEach(client => {
        const item = document.createElement('div');
        item.className = 'stats-item';
        item.innerHTML = `
            <div>
                <div class="client-name">${client.name}</div>
                <div class="text-sm text-gray-500">Gastado: $${client.totalSpent.toLocaleString('es-AR')}</div>
            </div>
            <div class="client-count" title="Cantidad de reservas">
                ${client.count}
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
        showMessage(`Error al cargar historial: ${error.message}. ¿Creaste el índice en Firestore?`, true);
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
        item.className = 'historial-item';
        const eventDate = entry.timestamp.toDate();
        const formattedTimestamp = eventDate.toLocaleString('es-AR', { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        let statusClass = '', statusText = '';
        switch(entry.action) {
            case 'created': statusClass = 'created'; statusText = 'Reserva Creada'; break;
            case 'updated': statusClass = 'updated'; statusText = 'Reserva Actualizada'; break;
            case 'deleted': statusClass = 'deleted'; statusText = 'Reserva Eliminada'; break;
            default: statusText = entry.action;
        }
        const courtHoursStr = entry.courtHours?.map(h => `${h}:00`).join(', ') || '-';
        const grillHoursStr = entry.grillHours?.map(h => `${h}:00`).join(', ') || '-';
        item.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <strong class="text-lg">${entry.teamName}</strong>
                    <div class="text-sm text-gray-500">Día: ${entry.day}</div>
                </div>
                <span class="status ${statusClass}">${statusText}</span>
            </div>
            <div class="text-sm text-gray-700 space-y-1">
                <p><strong>Horas Cancha:</strong> ${courtHoursStr}</p>
                <p><strong>Horas Parrilla:</strong> ${grillHoursStr}</p>
                 <p><strong>Método Pago:</strong> <span style="text-transform: capitalize;">${entry.paymentMethod || 'N/A'}</span></p>
                 <p class="text-xs text-gray-400">Registrado: ${formattedTimestamp}</p>
            </div>
            ${entry.action === 'deleted' && entry.reason ? `<div class="reason">Motivo: ${entry.reason}</div>` : ''}
        `;
        historialList.appendChild(item);
    });
}


// --- UTILIDADES (MENSAJES) ---
function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-xl font-semibold text-red-600' : 'text-xl font-semibold text-gray-700';
    messageOverlay.classList.add('is-open');
}
function hideMessage() {
    messageOverlay.classList.remove('is-open');
}
