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
    getDocs
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
    stats: document.getElementById('stats-view')
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

// Estadísticas (¡NUEVO!)
const statsList = document.getElementById('stats-list');
const statsDateFrom = document.getElementById('stats-date-from');
const statsDateTo = document.getElementById('stats-date-to');
const statsFilterBtn = document.getElementById('stats-filter-btn');

// Modales
const bookingModal = document.getElementById('booking-modal');
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const cajaDetailModal = document.getElementById('caja-detail-modal');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

// Formulario de Reserva
const bookingForm = document.getElementById('booking-form');
const teamNameInput = document.getElementById('teamName');
const teamNameSuggestions = document.getElementById('teamName-suggestions');

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
                await loadBookingsForMonth(); // Carga el calendario
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
            toggleMenu(); // Cierra el menú
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
    statsFilterBtn.onclick = loadStatsData; // ¡NUEVO!

    // Sugerencias de Cliente
    teamNameInput.oninput = handleTeamNameInput;
    teamNameInput.onblur = () => { setTimeout(() => { teamNameSuggestions.style.display = 'none'; }, 200); };
    teamNameInput.onfocus = handleTeamNameInput;
}

// --- LÓGICA DE NAVEGACIÓN ---

function toggleMenu() {
    mainMenu.classList.toggle('is-open');
    menuOverlay.classList.toggle('hidden');
}

function showView(viewName) {
    // Oculta todas las vistas
    for (const key in views) {
        views[key].classList.add('is-hidden');
    }
    // Muestra la vista seleccionada
    if (views[viewName]) {
        views[viewName].classList.remove('is-hidden');
    }
    
    // Carga los datos de la vista si es necesario
    if (viewName === 'caja') {
        loadCajaData();
    } else if (viewName === 'stats') {
        loadStatsData();
    }
}

// --- LÓGICA DE FIREBASE (RESERVAS) ---

async function loadBookingsForMonth() {
    // ... (sin cambios) ...
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

async function handleSaveBooking(event) {
    // ... (sin cambios) ...
    event.preventDefault();
    showMessage("Guardando...");
    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const teamName = document.getElementById('teamName').value.trim();
    const bookingData = {
        teamName: teamName,
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        hoursCount: parseInt(document.getElementById('hoursCount').value, 10),
        costPerHour: parseFloat(document.getElementById('costPerHour').value),
        rentGrill: document.getElementById('rentGrill').checked,
        grillCost: parseFloat(document.getElementById('grillCost').value),
        day: dateStr,
        monthYear: dateStr.substring(0, 7),
        userId: userId,
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value
    };
    try {
        if (bookingId) {
            await setDoc(doc(db, bookingsCollectionPath, bookingId), bookingData, { merge: true });
        } else {
            await addDoc(collection(db, bookingsCollectionPath), bookingData);
        }
        await saveCustomer(teamName);
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al guardar reserva:", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    }
}

async function handleDeleteBooking(bookingId) {
    // ... (sin cambios) ...
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta reserva?")) return;
    showMessage("Eliminando...");
    try {
        await deleteDoc(doc(db, bookingsCollectionPath, bookingId));
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al eliminar reserva:", error);
        showMessage(`Error al eliminar: ${error.message}`, true);
    }
}

// --- LÓGICA DE FIREBASE (CLIENTES) ---

async function saveCustomer(name) {
    // ... (sin cambios) ...
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
    // ... (sin cambios) ...
    const queryText = teamNameInput.value.trim().toLowerCase();
    if (queryText.length < 2) {
        teamNameSuggestions.style.display = 'none';
        return;
    }
    try {
        const customersRef = collection(db, customersCollectionPath);
        // Esta query es más simple y efectiva para "empieza con"
        const q = query(customersRef, 
            where(doc(db, customersCollectionPath, queryText).id, ">=", queryText),
            where(doc(db, customersCollectionPath, queryText).id, "<=", queryText + '\uf8ff')
        );
        const snapshot = await getDocs(q);
        const suggestions = snapshot.docs.map(doc => doc.data().name);
        renderSuggestions(suggestions);
    } catch (error) {
        console.error("Error al buscar clientes:", error);
    }
}

function renderSuggestions(suggestions) {
    // ... (sin cambios) ...
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
    // ... (sin cambios) ...
    teamNameInput.value = name;
    teamNameSuggestions.style.display = 'none';
}


// --- LÓGICA DEL CALENDARIO ---
// ... (sin cambios en renderCalendar, createDayCell, handleDayClick) ...
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
// ... (sin cambios significativos) ...
function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    bookingForm.reset();
    document.getElementById('booking-date').value = dateStr;
    document.querySelector('input[name="paymentMethod"][value="efectivo"]').checked = true;
    if (bookingToEdit) {
        document.getElementById('booking-modal-title').textContent = "Editar Reserva";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        document.getElementById('hoursCount').value = bookingToEdit.hoursCount;
        document.getElementById('costPerHour').value = bookingToEdit.costPerHour;
        document.getElementById('rentGrill').checked = bookingToEdit.rentGrill;
        document.getElementById('grillCost').value = bookingToEdit.grillCost;
        const paymentMethod = bookingToEdit.paymentMethod || 'efectivo';
        document.querySelector(`input[name="paymentMethod"][value="${paymentMethod}"]`).checked = true;
    } else {
        document.getElementById('booking-modal-title').textContent = `Reservar Turno (${dateStr})`;
        document.getElementById('booking-id').value = '';
    }
    bookingModal.classList.add('is-open');
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
    // ... (sin cambios) ...
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const totalCancha = (booking.costPerHour || 0) * (booking.hoursCount || 0);
    const totalParrilla = booking.rentGrill ? (booking.grillCost || 0) : 0;
    const totalFinal = totalCancha + totalParrilla;
    detailsEl.innerHTML = `
        <p><strong>Equipo:</strong> ${booking.teamName}</p>
        <p><strong>Personas:</strong> ${booking.peopleCount}</p>
        <p><strong>Método Pago:</strong> <span style="text-transform: capitalize;">${booking.paymentMethod || 'N/A'}</span></p>
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


// --- LÓGICA DE VISTA DE CAJA (MEJORADA) ---

async function loadCajaData() {
    if (!db) return;
    showMessage("Cargando datos de caja...");
    
    try {
        let q = query(collection(db, bookingsCollectionPath));
        const from = cajaDateFrom.value;
        const to = cajaDateTo.value;
        
        if (from) q = query(q, where("day", ">=", from));
        if (to) q = query(q, where("day", "<=", to));
        
        // ¡RECUERDA! Esta consulta requiere un índice compuesto en 'day'
        // Firestore te dará un enlace en la consola si falta.
        
        const snapshot = await getDocs(q);
        
        let grandTotal = 0;
        const dailyTotals = {};

        snapshot.docs.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() }; // Guardamos la reserva completa
            const total = (booking.costPerHour || 0) * (booking.hoursCount || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) : 0);
            
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
            dailyTotals[day].bookings.push(booking); // ¡NUEVO! Guardamos la reserva
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
    const sortedDays = Object.keys(dailyTotals).sort((a, b) => b.localeCompare(a)); // Más recientes primero
    
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
        // Pasamos el objeto 'data' completo, que incluye el array 'bookings'
        item.onclick = () => showCajaDetail(displayDate, data);
        cajaDailyList.appendChild(item);
    });
}

/**
 * Muestra el modal de detalle de caja (MEJORADO)
 */
function showCajaDetail(displayDate, data) {
    cajaDetailModal.classList.add('is-open');
    
    // Resumen de Pagos
    const summaryEl = document.getElementById('caja-detail-summary');
    summaryEl.innerHTML = `
        <p class="flex justify-between"><span>Efectivo:</span> <strong>$${data.efectivo.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Transferencia:</span> <strong>$${data.transferencia.toLocaleString('es-AR')}</strong></p>
        <p class="flex justify-between"><span>Mercado Pago:</span> <strong>$${data.mercadopago.toLocaleString('es-AR')}</strong></p>
        <hr class="my-2">
        <p class="flex justify-between text-lg font-bold"><span>Total Día:</span> <strong>$${data.total.toLocaleString('es-AR')}</strong></p>
    `;
    
    // ¡NUEVO! Lista de Reservas
    const listEl = document.getElementById('caja-detail-booking-list');
    listEl.innerHTML = '';
    if (data.bookings.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay detalles de reservas.</p>';
    } else {
        data.bookings.forEach(booking => {
            const total = (booking.costPerHour || 0) * (booking.hoursCount || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) : 0);
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


// --- LÓGICA DE VISTA DE ESTADÍSTICAS (¡NUEVA!) ---

async function loadStatsData() {
    if (!db) return;
    showMessage("Calculando estadísticas...");

    try {
        let q = query(collection(db, bookingsCollectionPath));
        const from = statsDateFrom.value;
        const to = statsDateTo.value;
        
        if (from) q = query(q, where("day", ">=", from));
        if (to) q = query(q, where("day", "<=", to));

        // Esta consulta usa el mismo índice 'day' que la vista de Caja
        const snapshot = await getDocs(q);

        const stats = {}; // Objeto para acumular estadísticas

        snapshot.docs.forEach(doc => {
            const booking = doc.data();
            const total = (booking.costPerHour || 0) * (booking.hoursCount || 0) + 
                          (booking.rentGrill ? (booking.grillCost || 0) : 0);
            
            // Normalizamos el nombre para agrupar (ej. "Martin" y "martin" son el mismo)
            const normalizedName = booking.teamName.trim().toLowerCase();
            
            if (!stats[normalizedName]) {
                // Si es la primera vez que vemos este nombre, lo inicializamos
                // Guardamos el nombre original (con mayúsculas) para mostrarlo
                stats[normalizedName] = { 
                    name: booking.teamName.trim(), 
                    count: 0, 
                    totalSpent: 0 
                };
            }
            
            // Acumulamos los datos
            stats[normalizedName].count++;
            stats[normalizedName].totalSpent += total;
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
    
    // Convertimos el objeto de stats en un array
    const statsArray = Object.values(stats);
    
    // Ordenamos el array por cantidad de reservas (descendente)
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


// --- UTILIDADES (MENSAJES) ---
function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-xl font-semibold text-red-600' : 'text-xl font-semibold text-gray-700';
    messageOverlay.classList.add('is-open');
}
function hideMessage() {
    messageOverlay.classList.remove('is-open');
}
