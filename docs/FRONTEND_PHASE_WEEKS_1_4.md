## Frontend phase overview

This phase covers the first 4 weeks of frontend learning.
Default stack:

- React
- Vite
- JavaScript
- JSX
- simple CSS
- local mock data

Do not add advanced tools just to make the project look better.

## Project initialization rule

When the student is starting a brand new React project, use the proper tool-based setup first.

For React + Vite projects:

- first inspect the current folder
- if the current folder is empty and the student is starting a new project, create a new child folder using a safe project name and scaffold the React + Vite app inside that folder
- if a valid React/Vite project already exists, work inside that existing project instead of creating another one
- do **not** manually create `package.json`, `index.html`, and config files from scratch unless the student explicitly asks for a manual setup
- do **not** create `package.json` manually before scaffolding
- do **not** pretend the project is ready if the Vite scaffold has not been created
- first scaffold the app with the normal React + Vite flow
- then place the project code inside that generated structure

Use the standard Vite-style setup approach:

1. inspect whether the current folder is empty or already contains a project
2. if needed, create a safe project folder name
3. create the project with React + Vite inside that folder
4. install dependencies
5. run the dev server
6. then edit `App.jsx`, components, and styles

If the student is a beginner, explain this clearly:

- Vite creates the correct starter structure for React
- that is why we should start from Vite instead of manually building the whole setup

Only manually create project files from scratch if:

- the project already exists
- the Vite scaffold is already present
- or the student explicitly asks for a manual setup explanation

## Frontend runtime debugging

If the student says the app is blank, does not run, or the browser shows nothing:

1. prioritize getting a visible result on screen first
2. ask for the exact error message if one exists
3. check the most likely first-run issues before giving long theory
4. give a corrected minimal runnable version if the current starter is broken

Check these first:

- the correct run command
- dev server output
- `main.jsx` mounting the app
- `App.jsx` returning valid JSX
- import paths
- syntax errors
- conditional rendering hiding everything

First make it run. Then explain why it failed.

## Curriculum map

Use this to infer the student's likely week, project slot, and task stage.

### Week 1

Day 1

- Stage: onboarding task
- Main project: Daily Pulse Board
- Alternatives: Coffee Preference Picker, Workout Intensity Selector, Team Check-in Board
- Focus: JSX, components, props, `useState`, click handlers, dynamic text/classes, conditional rendering

Day 2

- Stage: onboarding task
- Main project: Playlist Duel
- Alternatives: Trailer Showdown, Startup Name Vote, Weekend Activity Poll
- Focus: arrays of objects, `map`, `key`, reusable card components, derived state, conditional UI

Day 3

- Stage: early practice task
- Main project: Workshop RSVP + Ticket Preview
- Alternatives: Meetup Registration Form, Conference Session Signup, Film Screening RSVP
- Focus: controlled inputs, `onChange`, `onSubmit`, `preventDefault`, validation, success/error states, reset after submit, live preview

Days 4-5

- Stage: integration task
- Main project: Movie Night Planner
- Alternatives: Travel Destination Shortlist, Gift Ideas Selector, Restaurant Picker
- Focus: component decomposition, props, list rendering, search, filters, empty states, lifting state up, callbacks, shortlist/favorites, where state should live, basic folder structure

### Week 2

Days 6-7

- Stage: early practice task
- Main project: Reading Queue
- Alternatives: Watchlist Manager, Recipe Queue, Workout Plan Board
- Focus: arrays/objects in state, add item, delete item, toggle status, edit flow, immutable updates, filters, derived counts

Day 8

- Stage: early practice task
- Main project: Weekend Budget Splitter
- Alternatives: Road Trip Cost Splitter, Group Dinner Bill Planner, Festival Budget Calculator
- Focus: numeric inputs, parsing, validation, helper functions, totals, subtotals, derived state vs stored state, number formatting

Days 9-10

- Stage: integration task
- Main project: Recipe Box
- Alternatives: Bookmark Organizer, Closet / Outfit Planner, Local Places Wishlist
- Focus: larger component tree, form + list + filters, favorites, category filtering, `useEffect`, `localStorage`, load initial state, persist updates, reset flow

### Week 3

Days 11-15

- Stage: integration task
- Main project: City Weekend Planner
- Alternatives: Conference Agenda Builder, Study Sprint Planner, One-Day Travel Itinerary Builder
- Focus: larger local dataset, multi-filter UI, search, planning flow, notes, derived summaries, `localStorage`, helper extraction, reusable UI, sorting, reset filters, responsive cleanup, accessibility basics, polish

### Week 4

Days 16-20

- Stage: capstone task
- Main project: Rental Scout
- Alternatives: Event Discovery App, Coworking Space Browser, Freelancer Portfolio Marketplace
- Focus: app shell, pages, folder structure, browse page, saved items, React Router, `Link`, `NavLink`, route params, detail pages, inquiry/application form, confirmation states, capstone polish

## Frontend week limits

### Week 1

Teach:

- Vite setup
- JSX
- components
- props
- `useState`
- click handlers
- dynamic text and classes
- conditional rendering
- arrays of objects
- `map`
- `key`
- reusable card components
- controlled inputs
- `onChange`
- `onSubmit`
- `preventDefault`
- basic validation
- success and error states
- reset after submit
- live preview from state
- search
- simple filters
- lifting state up
- callbacks
- basic folder structure

Do not use:

- `useEffect`
- `localStorage`
- React Router
- route params
- API calls
- async fetching
- Context API
- reducers
- custom hooks
- form libraries
- state libraries

### Week 2

Teach everything from Week 1, plus:

- arrays and objects in state
- add, edit, delete flows
- toggle status
- immutable updates with `map`
- helper functions
- filters
- derived counts
- numeric inputs
- parsing and validation
- totals and subtotals
- derived state vs stored state
- formatting numbers
- `useEffect`
- `localStorage`
- load initial state
- persist updates
- reset flow
- larger component tree

Do not use:

- React Router
- route params
- backend integration
- authentication
- Context API
- reducers
- custom hooks
- form libraries
- state libraries

### Week 3

Teach everything from Week 2, plus:

- larger local datasets
- `data/` style organization
- multiple filters together
- search + category filters
- card layouts
- cross-component state flow
- notes per item
- state shape design
- derived summaries
- helper extraction
- reusable UI pieces
- improved folder structure
- sorting
- reset filters
- saved indicators
- responsive cleanup
- accessibility basics
- bug fixing and polish

Do not use:

- React Router
- route params
- backend integration
- authentication
- Context API
- reducers
- custom hooks
- form libraries
- state libraries

### Week 4

Teach everything from Week 3, plus:

- React Router
- routes and pages
- `Link`
- `NavLink`
- shared layout
- page boundaries
- app shell
- route params
- detail pages
- find by ID
- inquiry/application form
- confirmation states
- identifying what the backend can replace later

Do not use:

- real backend integration
- authentication
- Context API
- reducers
- custom hooks
- form libraries
- state libraries

## Still not allowed yet in this phase

Unless the teacher changes the curriculum, keep these out:

- Context API
- reducers
- custom hooks
- form libraries
- state libraries
- advanced effect patterns
- backend integration
- authentication
