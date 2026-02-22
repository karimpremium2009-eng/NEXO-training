import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, getDocs, orderBy, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmmp7gIjTM4n1siShTC2BkkfzbflURSQg",
  authDomain: "gym-tracker-a981b.firebaseapp.com",
  projectId: "gym-tracker-a981b",
  storageBucket: "gym-tracker-a981b.firebasestorage.app",
  messagingSenderId: "249419335929",
  appId: "1:249419335929:web:5dbba1bbfb48fa8e59ba28"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

window.app = {
    user: null,
    isLoginMode: true,
    allActivities: [], 
    currentDate: new Date(),
    
    showView(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if(viewId !== 'auth') {
            const navName = viewId === 'workout' ? 'gym' : viewId === 'dashboard' ? 'home' : viewId;
            const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn => btn.textContent.toLowerCase() === navName);
            if(activeBtn) activeBtn.classList.add('active');
        }

        if(viewId === 'dashboard') this.loadDashboard();
        if(viewId === 'profile') this.loadProfile();
        if(viewId === 'calendar') this.loadCalendar();
    },

    showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = `toast ${isError ? 'error' : ''}`;
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    toggleLoading(buttonId, isLoading) {
        const btn = document.querySelector(`#${buttonId}`);
        if(!btn) return;
        const text = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.loader');
        if(isLoading) {
            btn.disabled = true;
            if(text) text.classList.add('hidden');
            if(loader) loader.classList.remove('hidden');
        } else {
            btn.disabled = false;
            if(text) text.classList.remove('hidden');
            if(loader) loader.classList.add('hidden');
        }
    },

    async fetchAllActivities() {
        if(!this.user) return [];
        try {
            const qW = query(collection(db, `users/${this.user.uid}/workouts`), orderBy('date', 'desc'));
            const qR = query(collection(db, `users/${this.user.uid}/runs`), orderBy('date', 'desc'));
            const [snapW, snapR] = await Promise.all([getDocs(qW), getDocs(qR)]);
            
            let activities = [];
            
            const parseDate = (d) => {
                if (d && typeof d.toMillis === 'function') return d.toMillis();
                if (typeof d === 'string') return new Date(d).getTime();
                return d;
            };

            snapW.forEach(doc => {
                const data = doc.data();
                activities.push({ id: doc.id, ...data, date: parseDate(data.date), type: 'Gym' });
            });
            snapR.forEach(doc => {
                const data = doc.data();
                activities.push({ id: doc.id, ...data, date: parseDate(data.date), type: 'Run' });
            });
            
            activities.sort((a, b) => b.date - a.date);
            this.allActivities = activities;
            return activities;
        } catch (error) {
            console.error("Fetch Error:", error);
            return [];
        }
    },

    async loadDashboard() {
        if(!this.user) return;
        const list = document.getElementById('recent-activity-list');
        list.innerHTML = '<p style="text-align:center; padding: 20px;">Loading...</p>';
        
        const activities = await this.fetchAllActivities();
        list.innerHTML = '';
        
        if(activities.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding: 20px;">No activity yet. Start training!</p>';
            return;
        }

        activities.slice(0, 5).forEach(act => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const dateStr = new Date(act.date).toLocaleDateString();
            
            if(act.type === 'Gym') {
                div.innerHTML = `<div><h4>${act.exercise}</h4><p>${dateStr} • ${act.sets}x${act.reps}</p></div>
                                 <div class="pr-badge">${act.weight} kg</div>`;
            } else {
                div.innerHTML = `<div><h4>Running</h4><p>${dateStr} • ${act.time} min</p></div>
                                 <div class="pr-badge">${act.distance} km</div>`;
            }
            list.appendChild(div);
        });
    },

    async loadCalendar() {
        await this.fetchAllActivities();
        this.renderCalendar();
        this.calculateWeeklySummary();
    },

    renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        document.getElementById('current-month-year').textContent = new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const trainedDates = new Set(this.allActivities.map(act => {
            const d = new Date(act.date);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        }));

        for(let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            grid.appendChild(empty);
        }

        for(let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            
            const dateKey = `${year}-${month}-${day}`;
            if(trainedDates.has(dateKey)) {
                dayEl.classList.add('active-day');
            }

            dayEl.addEventListener('click', () => this.openDayModal(year, month, day));
            grid.appendChild(dayEl);
        }
    },

    calculateWeeklySummary() {
        const today = new Date();
        const dayOfWeek = today.getDay(); 
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
        
        const startOfWeek = new Date(today.setDate(diff)).setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        const daysTrainedThisWeek = new Set();
        
        this.allActivities.forEach(act => {
            if(act.date >= startOfWeek && act.date <= endOfWeek) {
                const d = new Date(act.date);
                daysTrainedThisWeek.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
            }
        });

        const count = daysTrainedThisWeek.size;
        document.getElementById('weekly-summary-content').innerHTML = `
            You trained <span style="color:var(--accent); font-weight:800; font-size:1.5rem;">${count}</span> days this week.<br>
            <span style="font-size: 0.9rem; color: #666;">Goal Consistency: ${Math.round((count/7)*100)}%</span>
        `;
    },

    openDayModal(year, month, day) {
        const modal = document.getElementById('day-modal');
        const list = document.getElementById('modal-activities-list');
        document.getElementById('modal-date-title').textContent = new Date(year, month, day).toLocaleDateString();
        
        const startOfDay = new Date(year, month, day, 0, 0, 0, 0).getTime();
        const endOfDay = new Date(year, month, day, 23, 59, 59, 999).getTime();
        
        const dayActivities = this.allActivities.filter(a => a.date >= startOfDay && a.date <= endOfDay);
        
        list.innerHTML = '';
        if(dayActivities.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#666;">No workouts on this day.</p>';
        } else {
            dayActivities.forEach(act => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.style.flexDirection = 'column';
                div.style.alignItems = 'flex-start';
                
                let details = act.type === 'Gym' ? `${act.sets} sets x ${act.reps} reps @ ${act.weight}kg` : `${act.distance}km in ${act.time} min`;
                let title = act.type === 'Gym' ? act.exercise : 'Running';

                div.innerHTML = `
                    <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <div><h4>${title}</h4><p>${details}</p></div>
                    </div>
                    <div style="width: 100%; display: flex; gap: 10px;">
                        <button class="btn-secondary btn-small w-100" onclick="app.editActivity('${act.id}')">Edit</button>
                        <button class="btn-primary btn-small w-100" style="background:#f44336;" onclick="app.deleteActivity('${act.id}')">Delete</button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
        modal.classList.remove('hidden');
    },

    async editActivity(id) {
        const activity = this.allActivities.find(a => a.id === id);
        if(!activity) return;

        try {
            const col = activity.type === 'Gym' ? 'workouts' : 'runs';
            let updateData = {};
            
            if(activity.type === 'Gym') {
                const weight = prompt(`Edit Weight (kg) for ${activity.exercise}:`, activity.weight);
                if(weight === null) return; 
                const sets = prompt(`Edit Sets for ${activity.exercise}:`, activity.sets);
                if(sets === null) return;
                const reps = prompt(`Edit Reps for ${activity.exercise}:`, activity.reps);
                if(reps === null) return;

                updateData = {
                    weight: parseFloat(weight),
                    sets: parseInt(sets),
                    reps: parseInt(reps)
                };
                if(isNaN(updateData.weight) || isNaN(updateData.sets) || isNaN(updateData.reps)) {
                    return this.showToast("Invalid numbers entered", true);
                }
            } else {
                const dist = prompt("Edit Distance (km):", activity.distance);
                if(dist === null) return;
                const time = prompt("Edit Time (min):", activity.time);
                if(time === null) return;

                updateData = {
                    distance: parseFloat(dist),
                    time: parseFloat(time),
                    pace: +(parseFloat(time) / parseFloat(dist)).toFixed(2)
                };
                if(isNaN(updateData.distance) || isNaN(updateData.time)) {
                    return this.showToast("Invalid numbers entered", true);
                }
            }

            await setDoc(doc(db, `users/${this.user.uid}/${col}`, id), updateData, { merge: true });
            this.showToast("Activity updated successfully!");
            
            await this.loadCalendar();
            const d = new Date(activity.date);
            this.openDayModal(d.getFullYear(), d.getMonth(), d.getDate());
            
        } catch (error) {
            console.error(error);
            this.showToast("Error updating activity", true);
        }
    },

    async deleteActivity(id) {
        const activity = this.allActivities.find(a => a.id === id);
        if(!activity) return;

        if(!confirm("Are you sure you want to permanently delete this activity?")) return;
        
        try {
            const col = activity.type === 'Gym' ? 'workouts' : 'runs';
            await deleteDoc(doc(db, `users/${this.user.uid}/${col}`, id));
            this.showToast("Activity deleted successfully");
            
            await this.loadCalendar();
            const d = new Date(activity.date);
            this.openDayModal(d.getFullYear(), d.getMonth(), d.getDate());
            
        } catch (error) {
            console.error(error);
            this.showToast("Error deleting activity", true);
        }
    },

    async loadProfile() {
        if(!this.user) return;
        const docRef = doc(db, "users", this.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('prof-name').value = data.name || '';
            document.getElementById('prof-weight').value = data.weight || '';
            document.getElementById('prof-height').value = data.height || '';
            document.getElementById('prof-goal').value = data.goal || '';
            document.getElementById('user-greeting').textContent = `Hello, ${data.name || 'Athlete'}`;
        }

        const prList = document.getElementById('pr-list');
        prList.innerHTML = '<p style="text-align:center; padding: 20px;">Calculating...</p>';
        
        const qW = query(collection(db, `users/${this.user.uid}/workouts`));
        const snapW = await getDocs(qW);
        
        let prs = {};
        snapW.forEach(doc => {
            const data = doc.data();
            const exName = data.exercise.toUpperCase();
            if(!prs[exName] || data.weight > prs[exName]) prs[exName] = data.weight;
        });

        prList.innerHTML = '';
        const prKeys = Object.keys(prs);
        if(prKeys.length === 0) prList.innerHTML = '<p style="text-align:center; padding: 20px;">No PRs yet.</p>';
        
        prKeys.forEach(ex => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div><h4>${ex}</h4><p>Max Weight</p></div><div class="pr-badge">${prs[ex]} kg</div>`;
            prList.appendChild(div);
        });
    }
};

document.getElementById('prev-month').addEventListener('click', () => {
    app.currentDate.setMonth(app.currentDate.getMonth() - 1);
    app.renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
    app.currentDate.setMonth(app.currentDate.getMonth() + 1);
    app.renderCalendar();
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('day-modal').classList.add('hidden');
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        app.user = user;
        document.getElementById('view-auth').classList.remove('active');
        document.getElementById('main-app').classList.remove('hidden');
        app.showView('dashboard');
    } else {
        app.user = null;
        document.getElementById('main-app').classList.add('hidden');
        app.showView('auth');
    }
});

document.getElementById('toggle-auth').addEventListener('click', () => {
    app.isLoginMode = !app.isLoginMode;
    document.getElementById('auth-title').textContent = app.isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('auth-btn').querySelector('.btn-text').textContent = app.isLoginMode ? 'Login' : 'Create Account';
    document.getElementById('toggle-auth').textContent = app.isLoginMode ? 'Need an account? Sign up' : 'Have an account? Login';
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    app.toggleLoading('auth-btn', true);
    const email = document.getElementById('auth-email').value;
    const pwd = document.getElementById('auth-password').value;
    
    try {
        if(app.isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pwd);
            app.showToast("Logged in successfully");
        } else {
            await createUserWithEmailAndPassword(auth, email, pwd);
            app.showToast("Account created successfully!");
        }
        e.target.reset();
    } catch (error) {
        app.showToast(error.message, true);
    } finally {
        app.toggleLoading('auth-btn', false);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

document.getElementById('workout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!app.user) return;
    
    const exercise = document.getElementById('wo-exercise').value.trim();
    const weight = parseFloat(document.getElementById('wo-weight').value);
    const sets = parseInt(document.getElementById('wo-sets').value);
    const reps = parseInt(document.getElementById('wo-reps').value);

    if(!exercise || isNaN(weight) || isNaN(sets) || isNaN(reps)) {
        app.showToast("Please enter valid workout data", true);
        return;
    }

    app.toggleLoading('workout-form button', true);
    const data = { exercise, weight, sets, reps, date: Date.now() };

    try {
        await addDoc(collection(db, `users/${app.user.uid}/workouts`), data);
        app.showToast("Gym workout saved successfully!");
        e.target.reset();
        await app.loadCalendar(); 
        app.showView('calendar');
    } catch (error) {
        console.error(error);
        app.showToast("Database Error: Could not save workout", true);
    } finally {
        app.toggleLoading('workout-form button', false);
    }
});

document.getElementById('run-form').addEventListener('input', () => {
    const dist = parseFloat(document.getElementById('run-distance').value);
    const time = parseFloat(document.getElementById('run-time').value);
    const preview = document.getElementById('run-pace-preview');
    if(dist > 0 && time > 0) {
        preview.textContent = `Pace: ${(time/dist).toFixed(2)} min/km`;
    } else {
        preview.textContent = `Pace: 0.00 min/km`;
    }
});

document.getElementById('run-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!app.user) return;
    
    const dist = parseFloat(document.getElementById('run-distance').value);
    const time = parseFloat(document.getElementById('run-time').value);

    if(isNaN(dist) || isNaN(time) || dist <= 0 || time <= 0) {
        app.showToast("Please enter valid run data", true);
        return;
    }

    app.toggleLoading('run-form button', true);
    const data = { distance: dist, time: time, pace: +(time/dist).toFixed(2), date: Date.now() };

    try {
        await addDoc(collection(db, `users/${app.user.uid}/runs`), data);
        app.showToast("Run saved successfully!");
        e.target.reset();
        document.getElementById('run-pace-preview').textContent = `Pace: 0.00 min/km`;
        await app.loadCalendar(); 
        app.showView('calendar');
    } catch (error) {
        console.error(error);
        app.showToast("Database Error: Could not save run", true);
    } finally {
        app.toggleLoading('run-form button', false);
    }
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!app.user) return;

    app.toggleLoading('profile-form button', true);
    const data = {
        name: document.getElementById('prof-name').value.trim(),
        weight: document.getElementById('prof-weight').value,
        height: document.getElementById('prof-height').value,
        goal: document.getElementById('prof-goal').value.trim()
    };

    try {
        await setDoc(doc(db, "users", app.user.uid), data, { merge: true });
        app.showToast("Profile updated successfully!");
        document.getElementById('user-greeting').textContent = `Hello, ${data.name || 'Athlete'}`;
    } catch (error) {
        app.showToast("Error updating profile", true);
    } finally {
        app.toggleLoading('profile-form button', false);
    }
});