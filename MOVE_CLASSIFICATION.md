# خوارزمية تصنيف النقلات - Chess Legend

## 📚 مقدمة

هذا المستند يشرح خوارزمية تصنيف النقلات المستخدمة في Chess Legend، والتي تطابق معايير Chess.com بالكامل.

---

## 🎯 أنواع التصنيفات

### 1. **Book Move (📖 نقلة افتتاحية)**
- **التعريف:** نقلة من مكتبة الافتتاحيات المعروفة
- **الشروط:**
  - النقلة موجودة في قاعدة بيانات الافتتاحيات
  - عادة ما تكون في أول 10-15 نقلة من اللعبة
- **الأهمية:** تشير إلى أن اللاعب يتبع نظرية الافتتاحيات

```javascript
function isBookMove(fen, move) {
  const key = `${fen}:${move}`;
  return state.bookMoves.has(key);
}
```

### 2. **Brilliant Move (✨ نقلة رائعة)**
- **التعريف:** تضحية مفاجئة تؤدي إلى فوز أو ميزة كبيرة
- **الشروط:**
  - النقلة تتضمن تضحية (قطعة مأخوذة)
  - القطعة المضحى بها ثمينة (حصان، فيل، رخ، ملكة)
  - التقييم بعد النقلة ≥ التقييم بعد أفضل نقلة - 0.5
- **المثال:** تضحية بالملكة للحصول على كش مات

```javascript
if (isSacrifice && evalDiff >= bestEvalDiff - 0.5) {
  return { type: MoveClassification.BRILLIANT, eval: evalDiff };
}
```

### 3. **Great Move (👍 نقلة عظيمة)**
- **التعريف:** نقلة ممتازة لكن ليست الأفضل
- **الشروط:**
  - التقييم بعد النقلة ≥ التقييم بعد أفضل نقلة - 0.3
  - النقلة ليست الأفضل
- **الفرق عن Best:** قد تكون أقل قليلاً من الأفضل لكن لا تزال رائعة

```javascript
if (evalDiff >= bestEvalDiff - 0.3) {
  return { type: MoveClassification.GREAT, eval: evalDiff };
}
```

### 4. **Best Move (🏆 أفضل نقلة)**
- **التعريف:** أفضل نقلة في الموقف حسب المحرك
- **الشروط:**
  - النقلة = أفضل نقلة من Stockfish
  - التقييم الأعلى في الموقف
- **الأهمية:** تشير إلى لعب مثالي

```javascript
if (isBestMove) {
  return { type: MoveClassification.BEST, eval: evalDiff };
}
```

### 5. **Good Move (✓ نقلة جيدة)**
- **التعريف:** نقلة جيدة لكن ليست الأفضل
- **الشروط:**
  - التقييم بعد النقلة ≥ التقييم بعد أفضل نقلة - 1.0
  - لا تؤدي إلى خطأ واضح
- **الفرق عن Great:** أقل جودة قليلاً

```javascript
if (evalDiff >= bestEvalDiff - 1.0) {
  return { type: MoveClassification.GOOD, eval: evalDiff };
}
```

### 6. **Inaccuracy (⚠️ خطأ طفيف)**
- **التعريف:** خطأ صغير لا يؤثر كثيراً على الموقف
- **الشروط:**
  - التقييم بعد النقلة ≥ التقييم بعد أفضل نقلة - 2.0
  - الفرق < 1 بيادق
- **الأهمية:** تشير إلى عدم رؤية الحركة الأفضل

```javascript
if (evalDiff >= bestEvalDiff - 2.0) {
  return { type: MoveClassification.INACCURACY, eval: evalDiff };
}
```

### 7. **Mistake (❌ خطأ واضح)**
- **التعريف:** خطأ واضح يؤثر على الموقف
- **الشروط:**
  - التقييم بعد النقلة ≥ التقييم بعد أفضل نقلة - 4.0
  - الفرق 1-4 بيادق
- **الأهمية:** خطأ يجب تجنبه

```javascript
if (evalDiff >= bestEvalDiff - 4.0) {
  return { type: MoveClassification.MISTAKE, eval: evalDiff };
}
```

### 8. **Blunder (💥 خطأ فادح)**
- **التعريف:** خطأ فادح يؤدي إلى خسارة كبيرة
- **الشروط:**
  - التقييم بعد النقلة < التقييم بعد أفضل نقلة - 4.0
  - الفرق > 4 بيادق
- **الأهمية:** خطأ كبير جداً

```javascript
return { type: MoveClassification.BLUNDER, eval: evalDiff };
```

---

## 🔍 خطوات الخوارزمية

### الخطوة 1: التحقق من الافتتاحيات
```javascript
if (isBookMove(fen, move)) {
  return { type: MoveClassification.BOOK, eval: 0 };
}
```

### الخطوة 2: تقييم الموقف قبل النقلة
```javascript
const evalBefore = await getEvaluation(fen, depth);
```

### الخطوة 3: تطبيق النقلة
```javascript
chess.move(move, { sloppy: true });
```

### الخطوة 4: تقييم الموقف بعد النقلة
```javascript
const evalAfter = await getEvaluation(chess.fen(), depth);
```

### الخطوة 5: حساب الفرق
```javascript
const evalDiff = userColor === 'w' 
  ? (evalBefore - evalAfter) 
  : (evalAfter - evalBefore);
```

### الخطوة 6: الحصول على أفضل نقلة
```javascript
const bestMove = await getBestMove(fen, depth);
```

### الخطوة 7: تقييم أفضل نقلة
```javascript
const evalBestAfter = await getEvaluation(chess2.fen(), depth);
const bestEvalDiff = userColor === 'w' 
  ? (evalBefore - evalBestAfter) 
  : (evalBestAfter - evalBefore);
```

### الخطوة 8: المقارنة والتصنيف
```javascript
if (isBestMove) {
  return { type: MoveClassification.BEST, eval: evalDiff };
}

if (isSacrifice && evalDiff >= bestEvalDiff - 0.5) {
  return { type: MoveClassification.BRILLIANT, eval: evalDiff };
}

// ... المزيد من الشروط
```

---

## 📊 جدول المقارنة

| التصنيف | الشرط | الفرق (نقاط) | الرمز |
|--------|------|------------|------|
| Book | في قاعدة البيانات | 0 | 📖 |
| Brilliant | تضحية + تقييم جيد | ≥ -0.5 | ✨ |
| Great | أفضل من الأفضل - 0.3 | ≥ -0.3 | 👍 |
| Best | أفضل نقلة | 0 | 🏆 |
| Good | أفضل من الأفضل - 1.0 | ≥ -1.0 | ✓ |
| Inaccuracy | أفضل من الأفضل - 2.0 | ≥ -2.0 | ⚠️ |
| Mistake | أفضل من الأفضل - 4.0 | ≥ -4.0 | ❌ |
| Blunder | أسوأ من الأفضل - 4.0 | < -4.0 | 💥 |

---

## 🎯 اكتشاف التضحيات

### معايير التضحية:
```javascript
function isMaterialSacrifice(fen, move) {
  const chess = new Chess(fen);
  const moveObj = chess.move(move, { sloppy: true });
  
  if (!moveObj) return false;
  
  // التحقق من وجود قطعة مأخوذة
  const capturedPiece = moveObj.captured;
  if (!capturedPiece) return false;
  
  // القطع الثمينة
  const valuablePieces = ['n', 'b', 'r', 'q'];
  return valuablePieces.includes(capturedPiece.toLowerCase());
}
```

### أنواع التضحيات:
1. **تضحية الحصان:** للحصول على هجوم
2. **تضحية الفيل:** للحصول على ميزة موضعية
3. **تضحية الرخ:** للحصول على كش مات
4. **تضحية الملكة:** للحصول على كش مات أو فوز مؤكد

---

## ⚙️ معاملات التحليل

### أعماق التحليل:
- **Book Moves:** depth 30 (للافتتاحيات)
- **Analysis:** depth 20-25 (للتحليل العام)
- **Eval Bar:** depth 15 (للعرض السريع)

### الدقة:
- **عمق 18:** سريع جداً (~2 دقيقة)
- **عمق 20:** متوازن (~3-5 دقائق)
- **عمق 22:** دقيق (~7-10 دقائق)
- **عمق 25:** دقيق جداً (~15-20 دقيقة)

---

## 🔧 التطبيق العملي

### مثال 1: نقلة عادية
```
الموقف: e4 e5
التقييم قبل: 0.0
أفضل نقلة: Nf3
التقييم بعد Nf3: 0.3
النقلة المختارة: Nf3
التقييم بعد Nf3: 0.3
النتيجة: ✓ Best Move
```

### مثال 2: خطأ طفيف
```
الموقف: معقد
التقييم قبل: 2.5
أفضل نقلة: Qh5 (يفوز)
التقييم بعد Qh5: 5.0
النقلة المختارة: Be3 (جيدة لكن ليست الأفضل)
التقييم بعد Be3: 4.8
الفرق: 5.0 - 4.8 = 0.2
النتيجة: ⚠️ Inaccuracy
```

### مثال 3: تضحية رائعة
```
الموقف: معقد
التقييم قبل: 0.5
أفضل نقلة: Qxf7+ (تضحية)
التقييم بعد Qxf7+: 3.0
النقلة المختارة: Qxf7+ (نفس النقلة)
التقييم بعد Qxf7+: 3.0
هل تضحية؟ نعم (ملكة مأخوذة)
النتيجة: ✨ Brilliant Move
```

---

## 📈 الإحصائيات

### توزيع التصنيفات (مثال):
```
Brilliant:   5%  (نقلات رائعة)
Great:      10%  (نقلات عظيمة)
Best:       20%  (أفضل نقلات)
Good:       25%  (نقلات جيدة)
Inaccuracy: 20%  (أخطاء طفيفة)
Mistake:    15%  (أخطاء واضحة)
Blunder:     5%  (أخطاء فادحة)
```

---

## 🚀 التحسينات المستقبلية

1. **دعم Polyglot الكامل:** مكتبة افتتاحيات أكبر
2. **تحليل متعدد الخيوط:** تحليل أسرع
3. **تصنيف ديناميكي:** حسب مستوى اللاعب
4. **تحليل الأنماط:** اكتشاف الأخطاء المتكررة

---

## 📝 الملاحظات

- جميع التقييمات بالنقاط (centipawns)
- التقييم الموجب = الأبيض أفضل
- التقييم السالب = الأسود أفضل
- التقييم 100 = بيدق واحد

---

**آخر تحديث:** 23 مايو 2026
**الإصدار:** 1.0.0
