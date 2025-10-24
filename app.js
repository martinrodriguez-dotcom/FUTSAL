// Importaciones de Firebase SDK (v11.x.x)
// Usamos los módulos ESM directos para navegador (sin NPM/build)
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
    onSnapshot
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

// --- VARIABLES GLOBALES DE LA APP ---
let db, auth, userId;
let currentMonthDate = new Date();
let currentBookingsUnsubscribe = null;
let allMonthBookings = [];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- REFERENCIAS AL DOM ---
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const bookingModal = document.getElementById('booking-modal');
const optionsModal = document.getElementById('options-modal');
const viewModal = document.getElementById('view-modal');
const bookingForm = document.getElementById('booking-form');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');

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
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado con éxito:', registration);
            })
            .catch(error => {
                console.error('Error al registrar el Service Worker:', error);
            });
    }
}

async function firebaseInit() {
    try {
        // Inicializar Firebase con tu config
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        await setPersistence(auth, browserLocalPersistence);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Usuario autenticado:", user.uid);
                userId = user.uid;
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
    document.getElementById('prev-month-btn').onclick = prevMonth;
    document.getElementById('next-month-btn').onclick = nextMonth;
    
    bookingForm.onsubmit = handleSaveBooking;
    document.getElementById('cancel-booking-btn').onclick = closeModals;
    document.getElementById('close-options-btn').onclick = closeModals;
    document.getElementById('close-view-btn').onclick = closeModals;
    document.getElementById('add-new-booking-btn').onclick = () => {
        const dateStr = optionsModal.dataset.date;
        closeModals();
        showBookingModal(dateStr);
    };

    [bookingModal, optionsModal, viewModal].forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) closeModals();
        };
    });
}


// --- LÓGICA DE FIREBASE ---

async function loadBookingsForMonth() {
    if (!db || !userId) return;
    
    showMessage("Cargando reservas...");

    if (currentBookingsUnsubscribe) {
        currentBookingsUnsubscribe();
    }

    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const monthYear = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    console.log(`Cargando datos para: ${monthYear}`);

    // ¡IMPORTANTE! Esta es la colección que usará tu app.
    // Deberás configurar tus Reglas de Seguridad en Firestore para 'bookings'.
    const collectionPath = "bookings"; 
    const bookingsCollection = collection(db, collectionPath);
    
    const q = query(bookingsCollection, where("monthYear", "==", monthYear));

    currentBookingsUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`Snapshot recibido: ${snapshot.docs.length} documentos.`);
        allMonthBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
        hideMessage();
    }, (error) => {
        console.error("Error al obtener reservas (onSnapshot):", error);
        showMessage(`Error al cargar datos: ${error.message}. ¿Configuraste las reglas de Firestore?`, true);
    });
}

async function handleSaveBooking(event) {
    event.preventDefault();
    showMessage("Guardando...");

    const bookingId = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const monthYear = dateStr.substring(0, 7);

    const bookingData = {
        teamName: document.getElementById('teamName').value,
        peopleCount: parseInt(document.getElementById('peopleCount').value, 10),
        hoursCount: parseInt(document.getElementById('hoursCount').value, 10),
        costPerHour: parseFloat(document.getElementById('costPerHour').value),
        rentGrill: document.getElementById('rentGrill').checked,
        grillCost: parseFloat(document.getElementById('grillCost').value),
        day: dateStr,
        monthYear: monthYear,
        userId: userId
    };

    try {
        const collectionPath = "bookings";

        if (bookingId) {
            // Actualizar
            const docRef = doc(db, collectionPath, bookingId);
            await setDoc(docRef, bookingData, { merge: true });
            console.log("Reserva actualizada:", bookingId);
        } else {
            // Crear
            const bookingsCollection = collection(db, collectionPath);
            const docRef = await addDoc(bookingsCollection, bookingData);
            console.log("Reserva creada:", docRef.id);
        }
        
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al guardar reserva:", error);
        showMessage(`Error al guardar: ${error.message}`, true);
    }
}

async function handleDeleteBooking(bookingId) {
    // Usamos un modal simple en lugar de confirm()
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta reserva?")) {
        return;
    }
    
    showMessage("Eliminando...");

    try {
        const collectionPath = "bookings";
        const docRef = doc(db, collectionPath, bookingId);
        await deleteDoc(docRef);
        
        console.log("Reserva eliminada:", bookingId);
        closeModals();
        hideMessage();
    } catch (error) {
        console.error("Error al eliminar reserva:", error);
        showMessage(`Error al eliminar: ${error.message}`, true);
    }
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
    for (let i = 0; i < firstDayOfMonth; i++) {
        const dayNum = daysInPrevMonth - firstDayOfMonth + 1 + i;
        calendarGrid.appendChild(createDayCell(dayNum, false));
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayBookingsCount = bookingsCountByDay[i] || 0;
        calendarGrid.appendChild(createDayCell(i, true, dayBookingsCount));
    }

    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
        calendarGrid.appendChild(createDayCell(i, false));
    }
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


// --- LÓGICA DE MODALES ---

function showBookingModal(dateStr, bookingToEdit = null) {
    closeModals();
    bookingForm.reset();
    
    document.getElementById('booking-date').value = dateStr;

    if (bookingToEdit) {
        document.getElementById('booking-modal-title').textContent = "Editar Reserva";
        document.getElementById('booking-id').value = bookingToEdit.id;
        document.getElementById('teamName').value = bookingToEdit.teamName;
        document.getElementById('peopleCount').value = bookingToEdit.peopleCount;
        document.getElementById('hoursCount').value = bookingToEdit.hoursCount;
        document.getElementById('costPerHour').value = bookingToEdit.costPerHour;
        document.getElementById('rentGrill').checked = bookingToEdit.rentGrill;
        document.getElementById('grillCost').value = bookingToEdit.grillCost;
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

    if (bookingsOnDay.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500">No hay reservas para este día.</p>';
    }

    bookingsOnDay.forEach(booking => {
        const itemEl = document.createElement('div');
        itemEl.className = 'p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center';
        itemEl.innerHTML = `
            <span class="font-medium text-gray-800">${booking.teamName}</span>
            <div class="flex gap-2">
                <button data-id="${booking.id}" class="btn-view px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200">Ver</button>
                <button data-id="${booking.id}" class="btn-edit px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200">Editar</button>
                <button data-id="${booking.id}" class="btn-delete px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-md hover:bg-red-200">Eliminar</button>
            </div>
        `;
        
        itemEl.querySelector('.btn-view').onclick = () => showViewModal(booking);
        itemEl.querySelector('.btn-edit').onclick = () => showBookingModal(dateStr, booking);
        itemEl.querySelector('.btn-delete').onclick = () => handleDeleteBooking(booking.id);

        listEl.appendChild(itemEl);
    });

    optionsModal.classList.add('is-open');
}

function showViewModal(booking) {
    closeModals();
    const detailsEl = document.getElementById('view-booking-details');
    const totalCancha = booking.costPerHour * booking.hoursCount;
    const totalParrilla = booking.rentGrill ? booking.grillCost : 0;
    const totalFinal = totalCancha + totalParrilla;

    detailsEl.innerHTML = `
        <p><strong>Equipo:</strong> ${booking.teamName}</p>
        <p><strong>Personas:</strong> ${booking.peopleCount}</p>
        <p><strong>Horas:</strong> ${booking.hoursCount}</p>
        <p><strong>Costo Cancha:</strong> $${totalCancha.toLocaleString('es-AR')}</p>
        <p><strong>Parrilla:</strong> ${booking.rentGrill ? 'Sí' : 'No'}</p>
        ${booking.rentGrill ? `<p><strong>Costo Parrilla:</strong> $${totalParrilla.toLocaleString('es-AR')}</p>` : ''}
        <hr class="my-2">
        <p class="text-lg font-bold"><strong>Total a Pagar:</strong> $${totalFinal.toLocaleString('es-AR')}</p>
    `;
    viewModal.classList.add('is-open');
}

function closeModals() {
    bookingModal.classList.remove('is-open');
    optionsModal.classList.remove('is-open');
    viewModal.classList.remove('is-open');
}


// --- LÓGICA DE NAVEGACIÓN Y UTILIDADES ---

function prevMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    loadBookingsForMonth();
}

function nextMonth() {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    loadBookingsForMonth();
}

function showMessage(msg, isError = false) {
    messageText.textContent = msg;
    messageText.className = isError ? 'text-xl font-semibold text-red-600' : 'text-xl font-semibold text-gray-700';
    messageOverlay.classList.add('is-open');
}

function hideMessage() {
    messageOverlay.classList.remove('is-open');
}
