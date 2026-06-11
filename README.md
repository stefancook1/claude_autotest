# ⚡ PySOAR Prep

An interactive study app for **Staff SOAR Engineer** interview preparation — fluid dark UI,
syntax-highlighted Python lessons, and interview-style quizzes with progress tracking.

## Run it

No build step, no dependencies. Either:

```bash
# open directly
open index.html            # macOS
xdg-open index.html        # Linux

# or serve it (recommended)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What's inside

**11 modules**, each with a SOAR-flavored lesson (real code you'd write on the job),
interview-tip callouts, and a 5-question quiz. Score **80%+** to mark a module as mastered.

| Track | Modules |
|---|---|
| Python Core | Variables & memory model · Comprehensions & generators · Decorators & closures |
| Concurrency | Threading & the GIL · Asyncio & async patterns |
| SOAR Engineering | JSON correlation & enrichment · Error handling & resilience · Slack integration · PagerDuty integration · Running on Kubernetes |
| Interview Day | Staff-level mock interview (system design, trade-offs, behavioral) |

## Features

- 🌊 Fluid UI — animated gradient background, glassmorphism, spring transitions, confetti on mastery
- 🐍 Custom Python syntax highlighter (zero dependencies)
- ✅ Interactive quizzes with instant feedback and explanations for every answer
- 📈 Progress ring + per-module mastery tracking, persisted in `localStorage`
- 📋 One-click copy on every code block
- 📱 Fully responsive (slide-out sidebar on mobile)
- ♿ Respects `prefers-reduced-motion`

## Structure

```
index.html   — shell (sidebar, progress ring, view container)
styles.css   — all styling and animations
content.js   — course content: lessons + quizzes (edit this to add modules)
app.js       — router, renderer, syntax highlighter, quiz engine, progress store
```

To add a module: add an entry to `COURSE.modules` in `content.js` and reference its id
in one of `COURSE.groups`. Everything else (nav, cards, quiz, progress) is generated.
