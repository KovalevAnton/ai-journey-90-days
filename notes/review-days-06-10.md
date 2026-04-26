# Ревью дней 6-10: RAG от нуля до полного пайплайна

---

## 1. Полная картина: что такое RAG

RAG — Retrieval-Augmented Generation. Идея: LLM знает много, но не
знает **твои** данные. Если пользователь спрашивает «когда дедлайн
по проекту X?» — Claude понятия не имеет. Но если ты найдёшь
нужный документ и вставишь его в промпт — Claude прочитает и ответит.

RAG — это система, которая автоматически находит нужный документ.

Без RAG:
```
Вопрос → Claude → "Я не знаю про ваш проект"
```

С RAG:
```
Вопрос → поиск по документам → найден релевантный кусок →
→ Claude получает [вопрос + кусок документа] → ответ с цитатой
```

Это не fine-tuning. Модель не переобучается. Ты просто
подкладываешь ей нужный контекст на лету. Дешевле, быстрее,
данные всегда актуальны (обновил документ → RAG подхватил).

### Полный пайплайн за 13 дней

```
Ingestion:     PDF → text extraction → chunking → embedding
Retrieval:     query embedding → cosine similarity → top-K
Reranking:     Claude judges relevance → reorder
Generation:    system prompt + retrieved docs → Claude answers
Streaming:     real-time token output
Multi-turn:    conversation history
```

Каждый шаг — отдельный день экспериментов. Разберём подробно.

---

## 2. Ingestion: подготовка документов

Ingestion — это один раз перед работой: берёшь документы, режешь
на куски, превращаешь в числа.

### Шаг 1: Извлечение текста

Если документ — маркдаун или текстовый файл, просто читаешь.
Если PDF — нужен парсер. Мы используем pdfjs-dist (Mozilla PDF.js):

```typescript
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const data = new Uint8Array(readFileSync(pdfPath));
const doc = await getDocument({ data }).promise;

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map(item => item.str).join(" ");
}
```

`getTextContent()` возвращает массив текстовых элементов — каждый
`item.str` это фрагмент текста с позицией на странице. Склеиваем
через пробел. Теряется структура (заголовки, таблицы, колонки), но
для простых документов работает.

Проблема PDF: один и тот же текст в маркдауне и PDF даёт разный
результат. В маркдауне есть `## Article 5: The Ex Rule` — чёткий
разделитель. В PDF — сплошной поток текста без маркеров. Чанкинг
поэтому сложнее.

### Шаг 2: Chunking (нарезка на куски)

Модель не может прочитать весь документ сразу — он может быть на
1000 страниц. Да и не нужно: пользователь спрашивает про конкретную
тему, и ему нужен конкретный кусок.

Три стратегии, которые мы сравнили:

**Naive (фиксированный размер)**
```typescript
for (let i = 0; i < text.length; i += 500) {
  chunks.push(text.slice(i, i + 500));
}
```

Режем текст каждые 500 символов. Тупо, но работает как baseline.
Проблема: разрез может пройти посреди предложения, посреди статьи.
Один чанк может содержать конец одной статьи и начало другой.

**Section-based (по заголовкам)**
```typescript
// Маркдаун: режем по ## заголовкам
const sections = text.split(/(?=^## )/m);

// PDF: режем по "Article N:" паттерну
const sections = text.split(/(?=Article \d+[\s:—–-])/i);
```

Каждый чанк — одна логическая единица (статья, раздел). Чанки
разного размера, но каждый семантически целый. Лучше naive, потому
что эмбеддинг одного чанка описывает одну тему, а не мешанину.

`(?=...)` — это lookahead в регулярке. Он находит позицию перед
паттерном, но не «съедает» его. `"Article 1: ... Article 2: ..."`
→ split → `["Article 1: ...", "Article 2: ..."]`. Без lookahead
заголовки бы потерялись.

**Overlapping (с перехлёстом)**
```typescript
// Секция + последние 2 предложения предыдущей + первые 2 следующей
```

Каждый чанк включает кусочки соседних секций. Идея: если ответ
на вопрос лежит на стыке двух секций, overlap поможет его найти.
На практике для нашего набора (50 коротких статей) разницы почти
не было — но на длинных документах с контекстными ссылками между
разделами это помогает.

### Результаты сравнения чанкинга (Day 09)

```
Naive:   12/12 (100%)  — маленькие чанки, много перекрытий
Section: 11/12 (92%)   — чистые, но пропустил edge case
Overlap: 11/12 (92%)   — overlap не помог с этим edge case
```

Edge case: «When is it okay to prioritize your girlfriend?» Ответ —
Article 50 (исключение из «Bros Before Hoes»). Эмбеддинг вопроса
ближе к Article 1 (правило «Bros Before Hoes»), потому что там
слова «girlfriend», «romantic interest». Article 50 говорит про
«The One» — другие слова, тот же смысл. Эмбеддинги не ловят это.

Naive выиграл случайно: при нарезке по 500 символов Article 1 и
Article 50 попали в один чанк (по позиции в тексте).

### Шаг 3: Embedding (превращение текста в числа)

```typescript
const resp = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: chunk.content,
});
const vector = resp.data[0].embedding; // число[1536]
```

Отправляем текст чанка в OpenAI → получаем вектор из 1536 чисел.
Этот вектор — «координаты смысла» текста в 1536-мерном
пространстве. Тексты про похожие темы оказываются рядом.

Модель `text-embedding-3-small`: дешёвая ($0.02 / 1M токенов),
быстрая, 1536 измерений. Есть `text-embedding-3-large` (3072
измерений, точнее, дороже). Для экспериментов small хватает.

Батчим по 20:
```typescript
const resp = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: batch.map(c => c.content), // массив строк!
});
```

Один API-вызов на 20 чанков вместо 20 отдельных вызовов. Быстрее
и дешевле (меньше overhead на HTTP).

Результат сохраняем в JSON: `vectors-section.json` — массив
объектов `{id, title, content, vector}`. Это наш «индекс» для
поиска. В продакшене это была бы vector database (Pinecone,
Qdrant, pgvector), но для 50 чанков JSON-файл — идеально.

---

## 3. Retrieval: поиск релевантных документов

Пользователь задаёт вопрос. Нужно найти, какие чанки содержат
ответ.

```typescript
export async function retrieve(query: string, topK = 5) {
  // 1. Загружаем индекс
  const index = JSON.parse(readFileSync("vectors-section.json", "utf-8"));

  // 2. Эмбеддим вопрос
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  const qVec = resp.data[0].embedding;

  // 3. Считаем cosine similarity с каждым чанком
  const scored = index.map(e => ({
    title: e.title,
    content: e.content,
    score: cosSim(qVec, e.vector),
  }));

  // 4. Сортируем по score, берём top-K
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}
```

**Cosine similarity** — математическая мера «похожести» двух
векторов. Формула: `cos(θ) = (A · B) / (|A| × |B|)`. Значение
от -1 до 1, где 1 = идентичный смысл, 0 = не связаны.

В коде:
```typescript
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function cosSim(a: number[], b: number[]): number {
  return dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));
}
```

`dot(a, a)` — это сумма квадратов элементов. `Math.sqrt(dot(a, a))`
— это длина (норма) вектора. Делим dot product на произведение
длин → получаем косинус угла между векторами.

**top-K = 5**: берём 5 самых похожих чанков. Почему 5, а не 3 или
10? На Day 09 мы увидели, что при top-3 Article 50 (позиция #4 по
similarity) не попадает в результаты. При top-5 — попадает.
При top-10 — слишком много шума для генерации.

Это линейный поиск: сравниваем вопрос с каждым из 50 чанков.
O(n) — для 50 чанков это наносекунды. Для миллиона документов
нужен approximate nearest neighbor (ANN) — Pinecone, FAISS, hnswlib.
Но принцип тот же: найти ближайшие векторы.

---

## 4. Reranking: Claude как судья релевантности (Day 11)

### Проблема

Embedding search находит **похожие слова**, не **похожий смысл**.
Вопрос «when can I prioritize my girlfriend?» содержит слова
близкие к Article 1 («Bros Before Hoes» — «romantic interest»,
«girlfriend»). Article 50 («The One» — «spend his life with»,
«genuinely found The One») — другая лексика, тот же смысл.

Embedding similarity: Article 1 → 42%, Article 50 → 36%.
По embedding Article 1 ближе. Но правильный ответ — Article 50.

### Решение

Берём top-10 по embedding (широкий захват), потом просим Claude
оценить, какие реально релевантны вопросу:

```typescript
async function rerank(query: string, candidates, topK: number) {
  const candidateList = candidates
    .map((c, i) => `[${i}] ${c.title}: ${c.content.slice(0, 150)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 100,
    system: `You are a relevance judge. Given a question and candidate
             documents, return the indices of the most relevant documents
             in order. Return ONLY a JSON array of indices.`,
    messages: [{
      role: "user",
      content: `Question: "${query}"\n\nCandidates:\n${candidateList}\n\nReturn top ${topK} as JSON array:`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  const match = text.match(/\[[\d,\s]+\]/);
  if (!match) return candidates.slice(0, topK); // fallback

  const indices = JSON.parse(match[0]);
  return indices.map(i => candidates[i]);
}
```

Claude **понимает** смысл, не только слова. Он видит «prioritize
girlfriend» + Article 50 «genuinely found The One» и понимает, что
это про одно и то же. Embedding этого не может.

### Защитный парсинг

```typescript
const match = text.match(/\[[\d,\s]+\]/);
if (!match) return candidates.slice(0, topK);
```

Claude должен вернуть `[4, 0, 2, 1, 3]`. Но LLM может добавить
текст: «Here are the indices: [4, 0, 2, 1, 3]». Regex вытаскивает
массив из любого текста. Если regex не сработал (Claude ответил
чем-то совсем неожиданным) — fallback на оригинальный порядок.
Система не ломается, просто работает как без reranking.

### Результаты (Day 11)

```
Embedding only:  12/12 (100%)
With reranking:  12/12 (100%)
```

Одинаковый hit rate! Но reranking изменил **порядок**:
- Embedding: Article 50 на позиции #4
- Reranked: Article 50 на позиции #1

Это влияет на generation: Claude уделяет больше внимания первым
документам в контексте. С reranking — ответ начинается с исключения
(правильно), без — с правила (менее точно).

### Стоимость

~200 input токенов для 10 кандидатов. ~$0.001 за вызов.
200-400ms дополнительной латентности. Для quality-sensitive
приложений — no-brainer.

---

## 5. Generation: Claude отвечает на основе найденных документов

```typescript
function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const docs = chunks
    .map((c, i) =>
      `<article index="${i + 1}" title="${c.title}">\n${c.content}\n</article>`
    )
    .join("\n\n");

  return `You are Barney Stinson's AI assistant...
Answer based ONLY on the provided articles.
Always cite the specific article(s) by name.
If the articles don't cover the question, say so.
Never make up articles that don't exist.

<bro_code_articles>
${docs}
</bro_code_articles>`;
}
```

### Что тут важно

**XML теги для документов.** Каждый чанк обёрнут в `<article>` с
title. Claude видит структуру: вот 5 статей, у каждой есть название
и текст. Он может ссылаться на них по имени в ответе.

**«Answer based ONLY on the provided articles»** — заземление
(grounding). Без этого Claude может «додумать» информацию из своих
обучающих данных. С этим — он ограничен предоставленными
документами. Если ответа нет в документах — должен сказать «не
покрывается».

**«Never make up articles that don't exist»** — anti-hallucination.
Claude может «выдумать» статью, которой нет в контексте. Явная
инструкция это предотвращает. Мы проверяем это тестом на
галлюцинацию: «What does the Bro Code say about cryptocurrency?» →
правильный ответ: «The articles don't cover this topic.»

**Persona (Barney Stinson)** — не обязательна для RAG, но
демонстрирует, что system prompt влияет на стиль, сохраняя точность.
«Denied high fives are a war crime in the Geneva Convention of
Brodom» — цитирует правильную статью, но подаёт в стиле Барни.

### Вызов API

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 512,
  system: buildSystemPrompt(chunks),
  messages: [{ role: "user", content: question }],
});
```

System prompt содержит документы. User message — вопрос. Claude
читает документы, находит ответ, формулирует в стиле Барни,
цитирует статью.

Важно: документы идут в **system prompt**, не в user message.
Почему? System prompt — это контекст, «фон». User message — это
задача. Claude обучен различать: system prompt = «вот что ты
знаешь», user message = «вот что тебя спрашивают». Если положить
документы в user message, модель может отнестись к ним как к
вопросу, а не как к контексту.

---

## 6. Eval: как проверять RAG-систему

### Два уровня проверки

**Retrieval eval** — нашли ли правильный документ?
```typescript
const retrievalPass = chunks.some(c =>
  c.title.toLowerCase().includes(tc.expectedArticle.toLowerCase())
);
```

Проверяем: в top-5 результатах есть статья с нужным заголовком?
Это бинарный тест — hit или miss. Не важно, на какой позиции (1
или 5), главное что попала.

**Content eval** — правильная ли информация в ответе?
```typescript
const contentPass = tc.expectedFacts.every(f =>
  answerLower.includes(f.toLowerCase())
);
```

Проверяем: ответ содержит ключевые факты? Для вопроса про
ex-girlfriend ожидаем «consent» и «six months». Substring matching.

**Hallucination eval** — отказался ли отвечать, когда нет данных?
```typescript
if (tc.expectRefusal) {
  const refusalSignals = [
    "don't cover", "doesn't cover", "not covered",
    "no article", "not mentioned",
  ];
  contentPass = refusalSignals.some(s => answerLower.includes(s));
}
```

Спрашиваем про криптовалюту. Bro Code не содержит ничего про
крипту. Claude должен сказать «не покрывается», а не выдумать
статью.

### Recurring lesson: eval bugs ≠ model bugs

На Day 10 eval показал 8/9. Причина: ожидали слово «quibble» в
ответе, Claude сказал «penny-pinching». Модель **права** — оба
слова описывают одно и то же. Баг в eval (слишком строгий
substring match), не в модели.

Паттерн повторяется: Day 04 — «1000» vs «1,000» (форматирование).
Day 10 — «quibble» vs «penny-pinching» (перефразировка). Day 13 —
«consent» отсутствует, но Claude сказал «explicit written consent»
в другой форме.

Практический вывод: на первых итерациях **чини eval**, не prompt.
Используй широкие проверки (contains «tab», а не contains
«quibble»), проверяй **концепции**, а не точные слова.

---

## 7. Паттерн __dirname в ESM

Мелочь, но важная для монорепозитория.

Проблема: все эксперименты запускаются из корня через
`npm run x -- experiments/day-10/rag.ts`. Рабочая директория —
корень. Но каждый файл читает данные из **своей** папки
(`vectors-section.json` лежит рядом с `rag.ts`).

Если писать `readFileSync("vectors-section.json")`, Node ищет
файл в рабочей директории (корень) — не находит. Нужен
абсолютный путь.

```typescript
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// __dirname = "/Users/anton/Code/ai-journey-90-days/experiments/day-10-bro-rag"

readFileSync(resolve(__dirname, "vectors-section.json"));
// Всегда найдёт файл рядом со скриптом, неважно откуда запущен
```

В CommonJS `__dirname` есть из коробки. В ESM (`"type": "module"`)
— нет. `import.meta.url` даёт `file:///path/to/rag.ts`,
`fileURLToPath` превращает в обычный путь, `dirname` отрезает
имя файла.

Хелпер `here()`:
```typescript
const here = (f: string) => resolve(__dirname, f);
// here("vectors-section.json") → полный путь к файлу
```

---

## 8. Guard для main() при import

```typescript
const isMain = process.argv[1]?.endsWith("rag.ts");
if (isMain) {
  const question = process.argv[2];
  rag(question).catch(console.error);
}
```

Проблема: `eval.ts` делает `import { retrieve } from "./rag.js"`.
Без guard'а Node выполняет весь файл при импорте — включая main().
main() пытается прочитать `process.argv[2]` (вопрос), не находит,
и делает `process.exit(1)`. Eval падает, не успев запуститься.

`process.argv[1]` — это путь к запущенному скрипту. Если запущен
`rag.ts` напрямую — `process.argv[1]` заканчивается на `rag.ts`,
guard пропускает. Если `rag.ts` импортирован из `eval.ts` —
`process.argv[1]` заканчивается на `eval.ts`, guard блокирует.

В Python это `if __name__ == "__main__":`. В Node ESM — ручная
проверка argv.

---

## 9. System prompt для RAG: чеклист

Из 5 дней экспериментов сложился чеклист для system prompt:

1. **Роль** — кто ты. «You are Barney Stinson's AI assistant.»
   Определяет тон и экспертизу.

2. **Источник данных** — «Answer based ONLY on the provided
   articles.» Без этого модель смешивает retrieved context с
   обучающими данными.

3. **Формат цитирования** — «Always cite the specific article(s)
   by name.» Пользователь должен видеть, откуда информация.

4. **Anti-hallucination** — «If the articles don't cover the
   question, say so. Never make up articles.» Явный запрет на
   выдумки.

5. **Длина ответа** — «Keep answers concise (3-5 sentences max).»
   Без ограничения Claude может написать эссе.

6. **Документы в XML** — `<article title="...">content</article>`.
   Структурированный формат, легко ссылаться.

Каждый пункт закрывает конкретный failure mode, обнаруженный
в экспериментах.

---

## 10. Ключевой trade-off RAG: точность retrieval vs качество generation

Это центральное противоречие, которое мы наблюдали на протяжении
всех пяти дней.

**Большие чанки** (page-based, 2375 chars):
- Retrieval: лучше. Больше контекста в одном векторе → ловит
  edge cases, правило + исключение в одном чанке.
- Generation: хуже. Claude получает 5 страниц текста (12k chars),
  из которых 80% нерелевантно. Ответ может быть размытым.
- Day 12 результат: 10/10 retrieval.

**Маленькие чанки** (section-based, 365 chars):
- Retrieval: хуже. Узкий контекст в векторе → пропускает
  смысловые связи между секциями.
- Generation: лучше. Claude получает 5 коротких релевантных
  кусков. Ответ точный, сфокусированный.
- Day 12 результат: 9/10 retrieval.

**Решение в продакшене:**
- Retrieve больше (top-10) маленькими чанками → catch edge cases.
- Rerank (Claude judge) → оставить top-5 по реальной релевантности.
- Generate из отфильтрованных 5 чанков → качественный ответ.

Это 3-stage pipeline из Day 11:
**embed → retrieve(10) → rerank(5) → generate**

Каждый этап компенсирует слабость предыдущего.
