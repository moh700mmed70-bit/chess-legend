# دليل التصميم - Chess Legend

## 🎨 نظام الألوان

### الألوان الأساسية

```css
/* الخلفيات */
--color-primary: #1a1410;      /* أسود داكن جداً */
--color-secondary: #2a2420;    /* أسود داكن */

/* الرقعة */
--color-board-light: #f0d9b5;  /* بيج فاتح */
--color-board-dark: #b58863;   /* بني داكن */

/* التمييز والتأثيرات */
--color-highlight: #baca44;    /* أصفر-أخضر (آخر نقلة) */
--color-accent: #7cb342;       /* أخضر (الأكسنت الرئيسي) */

/* الحالات */
--color-success: #4caf50;      /* أخضر (نجاح) */
--color-error: #f44336;        /* أحمر (خطأ) */
--color-warning: #ff9800;      /* برتقالي (تحذير) */
--color-info: #2196f3;         /* أزرق (معلومة) */

/* النصوص */
--color-light: #f5f5f5;        /* أبيض فاتح */
--color-dark: #333;            /* أسود */
```

### استخدام الألوان:

| العنصر | اللون | الاستخدام |
|--------|------|----------|
| الخلفية الرئيسية | `#1a1410` | الخلفية العامة |
| الرقعة الفاتحة | `#f0d9b5` | مربعات الرقعة الفاتحة |
| الرقعة الغامقة | `#b58863` | مربعات الرقعة الغامقة |
| آخر نقلة | `#baca44` | تمييز النقلة الأخيرة |
| الأكسنت | `#7cb342` | الأزرار والعناوين |
| النص الأساسي | `#f5f5f5` | النصوص العادية |

---

## 🔤 نظام الخطوط

### الخطوط المستخدمة:

```css
--font-serif: 'Cormorant Garamond', serif;
--font-sans: 'Reem Kufi', sans-serif;
--font-arabic: 'Amiri', serif;
```

### استخدام الخطوط:

| الاستخدام | الخط | الحجم | الوزن |
|----------|------|------|------|
| العناوين الكبيرة | Cormorant Garamond | 2-3rem | 700 |
| العناوين الصغيرة | Amiri | 1.1-1.5rem | 600 |
| النصوص العادية | Amiri | 0.95-1rem | 400 |
| الأزرار | Reem Kufi | 1rem | 600 |

---

## 📐 نظام المسافات

### وحدات المسافات:

```css
/* الفجوات الأساسية */
gap: 0.5rem;   /* فجوة صغيرة */
gap: 1rem;     /* فجوة متوسطة */
gap: 1.5rem;   /* فجوة كبيرة */
gap: 2rem;     /* فجوة كبيرة جداً */

/* الحشوات */
padding: 0.75rem;   /* حشوة صغيرة */
padding: 1rem;      /* حشوة متوسطة */
padding: 1.5rem;    /* حشوة كبيرة */
padding: 2rem;      /* حشوة كبيرة جداً */
```

---

## 🎯 مكونات الواجهة

### 1. الرأس (Header)

```html
<header>
  <div class="crown">♔</div>
  <h1>Chess Legend</h1>
  <p class="subtitle">تدريب شطرنج بالذكاء الاصطناعي • Stockfish 16+ WASM</p>
</header>
```

**الأنماط:**
- الخلفية: تدرج من `#1a1410` إلى `#2a2420`
- الحد السفلي: 3px solid `#7cb342`
- الهامش السفلي: 2rem
- النص: مركز

### 2. لوحة تسجيل الدخول (Login Panel)

```html
<section class="login-panel">
  <h2 class="login-title">أدخل اسم حسابك على Chess.com</h2>
  <p class="login-desc">...</p>
  <div class="input-group">
    <input class="username-input" ... />
    <button class="btn">جلب المباريات وتحليلها</button>
  </div>
</section>
```

**الأنماط:**
- الخلفية: تدرج
- الحد: 2px solid `#7cb342`
- الزوايا: 12px border-radius
- الحشوة: 3rem
- الظل: `0 8px 32px rgba(0, 0, 0, 0.3)`

### 3. الرقعة (Board)

```css
.board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  aspect-ratio: 1;
  gap: 0;
  border: 3px solid #111;
  border-radius: 6px;
}

.square {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  cursor: pointer;
}

.square.light {
  background-color: #f0d9b5;
}

.square.dark {
  background-color: #b58863;
}
```

**التأثيرات:**
- عند التمرير: `opacity: 0.8`
- آخر نقلة: `background-color: #baca44`
- التلميح: `background-color: #7cb342` مع animation
- الخطأ: `background-color: #f44336` مع shake animation

### 4. شريط التقييم (Eval Bar)

```html
<div class="eval-bar-wrapper">
  <div class="eval-bar">
    <div class="eval-fill" style="width: 50%;"></div>
  </div>
  <span class="eval-text">0.0</span>
</div>
```

**الأنماط:**
- الارتفاع: 24px
- التدرج: من `#7cb342` إلى `#9ccc65`
- الحد: 1px solid `#555`
- الزوايا: 4px border-radius

### 5. الأزرار (Buttons)

```css
.btn {
  padding: 0.75rem 1.5rem;
  background: #7cb342;
  color: #000;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover {
  background: #9ccc65;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(124, 179, 66, 0.4);
}
```

### 6. بطاقات الإحصائيات (Stat Cards)

```html
<div class="stat-card">
  <span class="stat-value">20</span>
  <span class="stat-label">المباريات المحللة</span>
</div>
```

**الأنماط:**
- الخلفية: تدرج
- الحد: 2px solid `#7cb342`
- الزوايا: 8px border-radius
- الحشوة: 1.5rem
- التأثير عند التمرير: `transform: translateY(-4px)`

### 7. لوحات المعلومات (Panels)

```html
<div class="panel">
  <h3>عنوان</h3>
  <div class="panel-content">...</div>
</div>
```

**الأنماط:**
- الخلفية: `#2a2420`
- الحد: 2px solid `#444`
- الزوايا: 8px border-radius
- الحشوة: 1.5rem
- الظل: `0 4px 12px rgba(0, 0, 0, 0.2)`

---

## 🎬 التأثيرات والحركات

### 1. Slide In (الانزلاق للداخل)

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**الاستخدام:** شريط الحالة، رسائل الخطأ

### 2. Pulse (النبض)

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

**الاستخدام:** التلميحات، المربعات المهمة

### 3. Shake (الاهتزاز)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

**الاستخدام:** الأخطاء، النقلات الخاطئة

### 4. Spin (الدوران)

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**الاستخدام:** مؤشر التحميل

---

## 📱 التصميم المتجاوب

### نقاط التوقف (Breakpoints):

```css
/* سطح المكتب */
@media (min-width: 1024px) {
  .trainer-layout {
    grid-template-columns: 1fr 350px;
  }
}

/* الأجهزة اللوحية */
@media (max-width: 1024px) {
  .trainer-layout {
    grid-template-columns: 1fr;
  }
}

/* الهواتف الذكية */
@media (max-width: 768px) {
  header h1 {
    font-size: 2rem;
  }
  
  .input-group {
    flex-direction: column;
  }
}

/* الهواتف الصغيرة */
@media (max-width: 480px) {
  .board {
    font-size: 2rem;
  }
}
```

---

## 🎨 رموز التصنيفات

### عرض الرموز على القطع:

```javascript
const classificationIcons = {
  'book': '📖',
  'brilliant': '✨',
  'great': '👍',
  'best': '🏆',
  'good': '✓',
  'inaccuracy': '⚠️',
  'mistake': '❌',
  'blunder': '💥'
};
```

### عرض الرموز في القائمة:

```html
<span class="move-item correct">♘f3</span>
<span class="move-item wrong">♗e3</span>
```

---

## 🎯 حالات الواجهة

### 1. حالة التحميل

```html
<div class="status-bar">
  <span class="spinner"></span>
  <span>جاري التحميل...</span>
</div>
```

### 2. حالة النجاح

```html
<div class="feedback success">
  <div class="feedback-title">حركة ممتازة!</div>
  <div>لقد وجدت الحل الصحيح</div>
</div>
```

### 3. حالة الخطأ

```html
<div class="feedback error">
  <div class="feedback-title">ليست الحركة الأفضل</div>
  <div>حاول مرة أخرى</div>
</div>
```

---

## 📐 نسب الأبعاد

### الرقعة:
- النسبة: 1:1 (مربع)
- الحد الأدنى: 300px
- الحد الأقصى: 600px

### البطاقات:
- العرض: 200-400px
- الارتفاع: متغير

### الأزرار:
- الارتفاع: 40-48px
- العرض: 100-200px

---

## 🔍 إمكانية الوصول (Accessibility)

### ARIA Labels:

```html
<div class="board" role="grid" aria-label="رقعة الشطرنج"></div>
<button aria-label="اللغز السابق">&larr; السابق</button>
<div role="status" aria-live="polite">جاري التحميل...</div>
```

### Semantic HTML:

```html
<header>...</header>
<section>...</section>
<footer>...</footer>
<button>...</button>
<input>...</input>
```

---

## 🌙 الوضع الليلي

جميع الألوان مصممة للوضع الليلي (Dark Mode) بشكل افتراضي.

---

## 📝 ملاحظات التصميم

1. **الاتساق:** جميع الأزرار والعناصر متسقة
2. **البساطة:** التصميم بسيط وواضح
3. **الأداء:** تأثيرات سلسة بدون تأخير
4. **الاستجابة:** يعمل على جميع الأجهزة
5. **التباين:** نسب تباين عالية للقراءة

---

**آخر تحديث:** 23 مايو 2026
**الإصدار:** 1.0.0
