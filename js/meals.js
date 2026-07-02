// ── DATE ─────────────────────────────────────────────────────────────────────
const today = new Date();
document.getElementById('sidebar-date').textContent =
  today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// ── MEAL PLANNER ─────────────────────────────────────────────────────────────
const MEAL_API   = '8a4c13fcd0a74d8aaaf0fc67118b8740';
const CUISINES   = ['Any','American','Italian','Mexican','Asian','Indian','Thai','Japanese'];
let selectedCuisine = 'Any';
let mealPlan       = JSON.parse(localStorage.getItem('mealplan')    || '{}');
let groceryChecked = JSON.parse(localStorage.getItem('grocerychecked') || '[]');
let groceryItems   = JSON.parse(localStorage.getItem('groceryitems')   || '[]');
let favorites      = JSON.parse(localStorage.getItem('mealfavorites')  || '[]');

function saveMealPlan()  { localStorage.setItem('mealplan',      JSON.stringify(mealPlan));       updateMealSub(); }
function saveChecked()   { localStorage.setItem('grocerychecked', JSON.stringify(groceryChecked)); }
function saveFavorites() { localStorage.setItem('mealfavorites',  JSON.stringify(favorites));      }
function isFav(id)       { return favorites.some(f => f.id === id); }

function toggleFav(meal) {
  if (isFav(meal.id)) { favorites = favorites.filter(f => f.id !== meal.id); }
  else { favorites.push(meal); }
  saveFavorites();
}

function updateMealSub() {
  const total = (mealPlan.week || []).length;
  document.getElementById('meal-header-sub').textContent =
    total === 0 ? 'Plan your week' : `${total} meal${total !== 1 ? 's' : ''} planned this week`;
}
updateMealSub();

// Build cuisine pills
const cr = document.getElementById('cuisine-row');
CUISINES.forEach(c => {
  const btn = document.createElement('button');
  btn.className = 'c-pill' + (c === 'Any' ? ' on' : '');
  btn.textContent = c;
  btn.onclick = () => {
    selectedCuisine = c;
    document.querySelectorAll('.c-pill').forEach(p => p.classList.remove('on'));
    btn.classList.add('on');
  };
  cr.appendChild(btn);
});

window.showMealTab = function(name) {
  ['suggest','favorites','plan','grocery'].forEach(n => {
    document.getElementById('meal-' + n).classList.toggle('active', n === name);
  });
  document.querySelectorAll('.meal-tab').forEach((t, i) => {
    t.classList.toggle('active', ['suggest','favorites','plan','grocery'][i] === name);
  });
  if (name === 'plan')      renderMealPlan();
  if (name === 'grocery')   renderGrocery();
  if (name === 'favorites') renderFavorites();
};

// ── PANTRY / FRIDGE SUGGESTIONS ──────────────────────────────────────────────
let pantryIngredients = [];

window.addPantryTag = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('pantry-input');
  const raw = input.value.trim().replace(/,+$/, '');
  if (!raw) return;
  const items = raw.split(',').map(s => s.trim()).filter(Boolean);
  items.forEach(item => {
    if (item && !pantryIngredients.includes(item.toLowerCase())) {
      pantryIngredients.push(item.toLowerCase());
    }
  });
  input.value = '';
  renderPantryTags();
};

function renderPantryTags() {
  const el = document.getElementById('pantry-tags');
  el.innerHTML = '';
  pantryIngredients.forEach((ing, i) => {
    const tag = document.createElement('div');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;background:var(--meal-green-l);border:1.5px solid var(--meal-green-b);font-size:12px;font-weight:700;color:var(--meal-green);';
    tag.innerHTML = `${ing} <span onclick="removePantryTag(${i})" style="cursor:pointer;font-size:14px;line-height:1;opacity:0.6;">×</span>`;
    el.appendChild(tag);
  });
  document.getElementById('pantry-suggest-btn').style.display = pantryIngredients.length > 0 ? 'block' : 'none';
}

window.removePantryTag = function(i) {
  pantryIngredients.splice(i, 1);
  renderPantryTags();
};

window.fetchPantrySuggestions = async function() {
  if (!pantryIngredients.length) return;
  const btn  = document.getElementById('pantry-suggest-btn');
  const grid = document.getElementById('meal-grid');
  btn.disabled = true;
  btn.textContent = '🔍 Finding meals...';
  grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><br>Finding meals from your ingredients...</div>';
  try {
    const res = await fetch('/api/suggest-meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: pantryIngredients })
    });
    if (!res.ok) throw new Error('Request failed');
    const { meals } = await res.json();
    renderPantryMealCards(meals);
  } catch(e) {
    grid.innerHTML = '<div class="spinner-wrap">Something went wrong. Try again!</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = '🍽️ Suggest Meals from My Ingredients';
  }
};

function renderPantryMealCards(meals) {
  const grid = document.getElementById('meal-grid');
  grid.innerHTML = '';
  const header = document.createElement('div');
  header.style.cssText = 'font-size:12px;color:var(--muted);font-weight:700;margin-bottom:12px;padding:8px 12px;background:var(--meal-green-l);border-radius:8px;border:1px solid var(--meal-green-b);';
  header.textContent = `✅ Based on: ${pantryIngredients.join(', ')}`;
  grid.appendChild(header);
  meals.forEach(m => {
    const card = document.createElement('div');
    card.className = 'meal-card';
    const usedHtml    = (m.usedIngredients    || []).map(i => `<span style="background:var(--meal-green-l);color:var(--meal-green);border:1px solid var(--meal-green-b);border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;">✓ ${i}</span>`).join('');
    const missingHtml = (m.missingIngredients || []).map(i => `<span style="background:#FFF7ED;color:#EA580C;border:1px solid #FED7AA;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;">+ ${i}</span>`).join('');
    card.innerHTML = `
      <div class="meal-img-ph" style="font-size:52px;">${m.emoji || '🍽️'}</div>
      <div class="meal-body">
        <div class="meal-name">${m.title}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:8px;line-height:1.4;">${m.description}</div>
        <div class="meal-meta">
          ${m.readyInMinutes ? `<span>⏱ ${m.readyInMinutes} min</span>` : ''}
          ${m.servings       ? `<span>👤 Serves ${m.servings}</span>`    : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${usedHtml}${missingHtml}</div>
        <div class="meal-actions">
          <button class="btn-add" onclick="addPantryMealToPlan('${m.title.replace(/'/g,"\\'")}','${m.emoji || '🍽️'}',this)">+ Add to Plan</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.addPantryMealToPlan = function(title, emoji, btn) {
  if (!mealPlan.week) mealPlan.week = [];
  const id = 'pantry_' + Date.now();
  if (!mealPlan.week.find(m => m.title === title)) {
    mealPlan.week.push({ id, title, image: '', emoji });
  }
  saveMealPlan();
  if (btn) { btn.textContent = '✓ Added'; btn.classList.add('added'); }
  showToast(`${emoji} "${title}" added to your plan!`);
};

// ── CUISINE SEARCH ────────────────────────────────────────────────────────────
window.fetchSuggestions = async function() {
  const btn         = document.getElementById('suggest-btn');
  const grid        = document.getElementById('meal-grid');
  const searchInput = document.getElementById('meal-search-input');
  const query       = searchInput ? searchInput.value.trim() : '';
  btn.disabled = true;
  btn.textContent = 'Finding meals...';
  grid.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><br>Finding meal ideas...</div>';
  try {
    const cuisine = selectedCuisine === 'Any' ? '' : `&cuisine=${selectedCuisine}`;
    const search  = query ? `&query=${encodeURIComponent(query)}` : '';
    const res  = await fetch(`https://api.spoonacular.com/recipes/complexSearch?apiKey=${MEAL_API}&number=8${cuisine}${search}&addRecipeInformation=true&sort=random`);
    const data = await res.json();
    if (!data.results || !data.results.length) {
      grid.innerHTML = `<div class="spinner-wrap">No results${query ? ` for "${query}"` : ''}. Try a different search or cuisine!</div>`;
      return;
    }
    renderMealCards(data.results);
  } catch(e) {
    grid.innerHTML = '<div class="spinner-wrap">Something went wrong. Try again.</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Find Meal Ideas';
  }
};

function renderMealCards(recipes) {
  const grid = document.getElementById('meal-grid');
  grid.innerHTML = '';
  recipes.forEach(r => {
    const isAdded = (mealPlan.week || []).some(m => m.id === r.id);
    const favd    = isFav(r.id);
    const meal    = { id: r.id, title: r.title, image: r.image || '', readyInMinutes: r.readyInMinutes, servings: r.servings };
    const card    = document.createElement('div');
    card.className = 'meal-card';
    card.innerHTML = `
      ${r.image ? `<img class="meal-img" src="${r.image}" alt="${r.title}" loading="lazy">` : `<div class="meal-img-ph">🍽️</div>`}
      <div class="meal-body">
        <div class="meal-name">${r.title}</div>
        <div class="meal-meta">
          ${r.readyInMinutes                          ? `<span>⏱ ${r.readyInMinutes} min</span>`  : ''}
          ${r.servings                                ? `<span>👤 Serves ${r.servings}</span>`     : ''}
          ${r.cuisines && r.cuisines.length           ? `<span>🌍 ${r.cuisines[0]}</span>`         : ''}
        </div>
        <div class="meal-actions">
          <button class="btn-add ${isAdded ? 'added' : ''}" id="addbtn-${r.id}"
            onclick="addMealToPlan(${r.id},'${r.title.replace(/'/g,"\\'")}','${r.image || ''}')">
            ${isAdded ? '✓ Added' : '+ Add to Plan'}
          </button>
          <button class="btn-recipe" onclick="openRecipe(${r.id})">View Recipe</button>
          <button class="btn-fav ${favd ? 'faved' : ''}" id="favbtn-${r.id}"
            onclick="toggleFavBtn(${r.id},'${r.title.replace(/'/g,"\\'")}','${r.image || ''}',${r.readyInMinutes || 0},${r.servings || 0})">
            ${favd ? '⭐' : '☆'}
          </button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.toggleFavBtn = function(id, title, image, readyInMinutes, servings) {
  const meal = { id, title, image, readyInMinutes, servings };
  toggleFav(meal);
  const btn = document.getElementById('favbtn-' + id);
  if (btn) { btn.textContent = isFav(id) ? '⭐' : '☆'; btn.classList.toggle('faved', isFav(id)); }
};

function renderFavorites() {
  const el = document.getElementById('favorites-list');
  el.innerHTML = '';
  if (!favorites.length) { el.innerHTML = '<div class="empty-state">No favorites yet.<br>Star a meal to save it here!</div>'; return; }
  favorites.forEach(f => {
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.innerHTML = `
      ${f.image ? `<img class="fav-img" src="${f.image}" alt="${f.title}">` : `<div class="fav-img-ph">🍽️</div>`}
      <div class="fav-body">
        <div class="fav-name">${f.title}</div>
        <div class="fav-meta">
          ${f.readyInMinutes ? `⏱ ${f.readyInMinutes} min` : ''}
          ${f.servings       ? ` · 👤 ${f.servings}`       : ''}
        </div>
        <div class="fav-actions">
          <button class="fav-btn-sm green" onclick="addMealToPlan(${f.id},'${f.title.replace(/'/g,"\\'")}','${f.image || ''}')">+ Add to Plan</button>
          <button class="fav-btn-sm" onclick="openRecipe(${f.id})">Recipe</button>
          <button class="fav-btn-sm red" onclick="removeFav(${f.id})">Remove</button>
        </div>
      </div>`;
    el.appendChild(card);
  });
}

window.removeFav = function(id) {
  favorites = favorites.filter(f => f.id !== id);
  saveFavorites();
  renderFavorites();
};

window.addMealToPlan = function(id, title, image) {
  if (!mealPlan.week) mealPlan.week = [];
  if (!mealPlan.week.find(m => m.id === id)) mealPlan.week.push({ id, title, image });
  saveMealPlan();
  const btn = document.getElementById('addbtn-' + id);
  if (btn) { btn.textContent = '✓ Added'; btn.classList.add('added'); }
  showToast(`🍽️ "${title}" added to your plan!`);
};

function renderMealPlan() {
  const el    = document.getElementById('plan-list');
  el.innerHTML = '';
  const meals = mealPlan.week || [];
  if (!meals.length) { el.innerHTML = '<div class="empty-state">No meals planned yet.<br>Go to Suggest to find meal ideas!</div>'; return; }
  meals.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'plan-day';
    row.innerHTML = `
      <div class="plan-day-head">
        <div class="plan-day-name">${m.emoji || '🍽️'} ${m.title}</div>
        <button class="btn-remove" onclick="removeMeal(${i})">Remove</button>
      </div>`;
    el.appendChild(row);
  });
}

window.removeMeal = function(idx) {
  (mealPlan.week || []).splice(idx, 1);
  saveMealPlan();
  renderMealPlan();
};

function buildGroceryText() {
  const allIngredients = [];
  (mealPlan.week || []).forEach(m => {
    if (m.ingredients) m.ingredients.forEach(ing => { if (!allIngredients.includes(ing)) allIngredients.push(ing); });
  });
  return allIngredients;
}

function renderGrocery() {
  const el       = document.getElementById('grocery-list');
  const progress = document.getElementById('grocery-progress');
  el.innerHTML   = '';
  const items    = groceryItems.length ? groceryItems : buildGroceryText();
  if (!items.length) {
    el.innerHTML = '<div class="empty-state">Your grocery list is empty.<br>Add meals to your plan to build a list!</div>';
    progress.textContent = '';
    return;
  }
  const done  = items.filter(i => groceryChecked.includes(i)).length;
  progress.textContent = `${done} of ${items.length} items checked`;
  items.forEach(item => {
    const checked = groceryChecked.includes(item);
    const row     = document.createElement('div');
    row.className = 'grocery-item' + (checked ? ' checked' : '');
    row.onclick   = () => {
      if (checked) { groceryChecked = groceryChecked.filter(c => c !== item); }
      else         { groceryChecked.push(item); }
      saveChecked();
      renderGrocery();
    };
    row.innerHTML = `
      <div class="gi-check">${checked ? '✓' : ''}</div>
      <div class="gi-name">${item}</div>`;
    el.appendChild(row);
  });
  const clearBtn = document.createElement('button');
  clearBtn.className   = 'clear-btn';
  clearBtn.textContent = 'Clear checked items';
  clearBtn.onclick     = () => { groceryChecked = []; saveChecked(); renderGrocery(); };
  el.appendChild(clearBtn);
}

// ── RECIPE ────────────────────────────────────────────────────────────────────
window.openRecipe = async function(id) {
  const ov    = document.getElementById('recipe-ov');
  const sheet = document.getElementById('recipe-sheet');
  ov.style.display = 'flex';
  sheet.innerHTML  = '<div class="spinner-wrap"><div class="spinner"></div><br>Loading recipe...</div>';
  try {
    const res  = await fetch(`https://api.spoonacular.com/recipes/${id}/information?apiKey=${MEAL_API}&includeNutrition=false`);
    const r    = await res.json();
    const ings = (r.extendedIngredients || []).map(i => `<div class="recipe-ing">${i.original}</div>`).join('');
    const steps = (r.analyzedInstructions?.[0]?.steps || []).map((s, i) =>
      `<div class="recipe-step"><div class="step-num">${i + 1}</div><div class="step-txt">${s.step}</div></div>`).join('');
    sheet.innerHTML = `
      <h2>${r.title}</h2>
      <div class="recipe-meta">
        ${r.readyInMinutes ? `<span>⏱ ${r.readyInMinutes} min</span>` : ''}
        ${r.servings       ? `<span>👤 Serves ${r.servings}</span>`    : ''}
        ${r.cuisines && r.cuisines.length ? `<span>🌍 ${r.cuisines[0]}</span>` : ''}
      </div>
      <div class="recipe-section-title">Ingredients</div>
      ${ings || '<div class="recipe-ing">No ingredient info available.</div>'}
      <div class="recipe-section-title">Instructions</div>
      ${steps || '<div class="step-txt">No instructions available for this recipe.</div>'}
      <button class="close-btn" onclick="closeRecipe()">Close</button>`;
  } catch(e) {
    sheet.innerHTML = '<div class="spinner-wrap">Could not load recipe. Try again.</div>';
  }
};

window.closeRecipe = () => { document.getElementById('recipe-ov').style.display = 'none'; };

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(message) {
  const existing = document.getElementById('meal-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'meal-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:24px;
    font-size:13px;font-weight:700;font-family:'Nunito Sans',sans-serif;
    box-shadow:0 4px 16px rgba(0,0,0,0.25);z-index:9999;
    opacity:0;transition:opacity 0.2s ease;pointer-events:none;white-space:nowrap;`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => { toast.style.opacity = '1'; }));
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 250); }, 3000);
}
