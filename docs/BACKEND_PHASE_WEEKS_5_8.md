# Backend phase overview

This phase covers Weeks 5-8.
The goal is to move from frontend-only apps to small real full-stack apps.

Default stack:

- React frontend
- Express.js backend
- PostgreSQL database
- simple CSS

Keep the stack simple.
Do not add advanced tools just to make the project look better.

## Project continuity rule

Do not assume every backend week is a brand new unrelated app.

- Week 5 usually continues the Phase 1 frontend capstone theme into backend APIs.
- Weeks 6 and 7 may use smaller scoped reset projects when database or auth clarity matters more than project continuity.
- Week 8 should bring the learned pieces together into one small full-stack capstone.

So the flow is:

- continue the theme where that helps learning
- reset to a smaller scoped project where that makes the concept clearer
- do not force one giant project across the whole phase
- do not treat every day like a fresh unrelated app

## Backend project initialization rule

When the student is starting a new backend or full-stack project:

- first inspect the current folder
- if the current folder is empty and the student is starting a new project, create a safe project folder
- if the project already exists, work inside that project
- use the normal tool-based setup for React, Express.js, and PostgreSQL
- do not manually create a fake app structure and pretend the project is ready
- verify the frontend and backend can both run before claiming the checkpoint is working

For backend-focused weeks:

- keep the backend simple and readable
- organize routes and helpers only when they become useful
- use seed data or in-memory data before PostgreSQL is introduced
- introduce PostgreSQL only in the weeks where it belongs

## Backend runtime debugging

If the student says the backend does not run, the API is not working, or React cannot fetch data:

1. first make the backend run
2. ask for the exact error message if one exists
3. check the most likely setup or connection issues before giving long theory
4. fix the runnable path first

Check these first:

- correct run command
- server port
- route path spelling
- JSON parsing middleware
- CORS setup
- database connection string
- PostgreSQL running
- frontend API URL

First make it run. Then explain why it failed.

## Curriculum map

Use this to infer the student's likely week, project slot, and task stage.

### Week 5

Day 21

- Stage: onboarding task
- Main project: Rental Scout API
- Alternatives: Event Discovery API, Coworking Space API, Freelancer Marketplace API, Local Services Directory API
- Focus: client vs server, first API route, JSON response, health route

Day 22

- Stage: early practice task
- Main project: Rental Scout API
- Alternatives: Event Discovery API, Coworking Space API, Freelancer Marketplace API, Local Services Directory API
- Focus: REST basics, GET all items, GET item by ID, route params, simple error responses

Day 23

- Stage: early practice task
- Main project: Rental Scout API
- Alternatives: Event Discovery API, Coworking Space API, Freelancer Marketplace API, Local Services Directory API
- Focus: fetch, loading states, error states, replacing mock frontend data, CORS basics

Day 24

- Stage: early practice task
- Main project: Rental Scout API
- Alternatives: Event Discovery API, Coworking Space API, Freelancer Marketplace API, Local Services Directory API
- Focus: POST request, request body, backend validation, temporary in-memory data

Day 25

- Stage: integration task
- Main project: Rental Scout API
- Alternatives: Event Discovery API, Coworking Space API, Freelancer Marketplace API, Local Services Directory API
- Focus: route organization, helper functions, API testing, frontend-backend flow review

### Week 6

Day 26

- Stage: onboarding task
- Main project: Listing Manager with Database
- Alternatives: Inventory Manager, Student Assignment Planner, Recipe Admin Panel, Local Event Manager
- Focus: why memory is not enough, tables, IDs, schema thinking, seed data

Day 27

- Stage: early practice task
- Main project: Listing Manager with Database
- Alternatives: Inventory Manager, Student Assignment Planner, Recipe Admin Panel, Local Event Manager
- Focus: connect backend to PostgreSQL, fetch all records, fetch one record, show database data in React

Day 28

- Stage: early practice task
- Main project: Listing Manager with Database
- Alternatives: Inventory Manager, Student Assignment Planner, Recipe Admin Panel, Local Event Manager
- Focus: form to API to database, POST endpoint, insert record, validation, confirmation state

Day 29

- Stage: early practice task
- Main project: Listing Manager with Database
- Alternatives: Inventory Manager, Student Assignment Planner, Recipe Admin Panel, Local Event Manager
- Focus: update, delete, edit flow, refetch-after-save, failed requests

Day 30

- Stage: integration task
- Main project: Listing Manager with Database
- Alternatives: Inventory Manager, Student Assignment Planner, Recipe Admin Panel, Local Event Manager
- Focus: admin-style CRUD screen, validation messages, empty states, cleanup

### Week 7

Day 31

- Stage: onboarding task
- Main project: Private Saved Listings + Inquiry Dashboard
- Alternatives: Private Notes App, Workout Logger, Reading Tracker, Personal Finance Tracker
- Focus: signup, login, password basics, sessions or tokens, current user idea

Day 32

- Stage: early practice task
- Main project: Private Saved Listings + Inquiry Dashboard
- Alternatives: Private Notes App, Workout Logger, Reading Tracker, Personal Finance Tracker
- Focus: login page, logout, redirects, protected routes, nav changes

Day 33

- Stage: early practice task
- Main project: Private Saved Listings + Inquiry Dashboard
- Alternatives: Private Notes App, Workout Logger, Reading Tracker, Personal Finance Tracker
- Focus: user-owned data, favorites, inquiries, filtering by current user

Day 34

- Stage: early practice task
- Main project: Private Saved Listings + Inquiry Dashboard
- Alternatives: Private Notes App, Workout Logger, Reading Tracker, Personal Finance Tracker
- Focus: ownership checks, 401 vs 403, backend authorization mindset

Day 35

- Stage: integration task
- Main project: Private Saved Listings + Inquiry Dashboard
- Alternatives: Private Notes App, Workout Logger, Reading Tracker, Personal Finance Tracker
- Focus: private dashboard, test with two users, bug fixing, explain auth flow

### Week 8

Days 36-40

- Stage: capstone task
- Main project: Rental Scout Full-Stack v1
- Alternatives: Event Booking App, Coworking Space Browser, Local Services Directory, Mini Job Board
- Focus: schema, routes, pages, seed data, validation, frontend integration, auth, user dashboard, polish, demo

## Backend week limits

### Week 5

Teach:

- client vs server
- Express.js setup
- health route
- JSON responses
- GET routes
- route params
- simple error responses
- fetch
- loading states
- error states
- CORS basics
- POST requests
- request body
- `express.json()`
- simple backend validation
- in-memory data
- route cleanup
- helper functions

Do not use:

- PostgreSQL
- authentication
- protected routes
- advanced middleware
- file uploads
- real email sending
- advanced backend architecture
- payments

### Week 6

Teach everything from Week 5, plus:

- PostgreSQL basics
- tables, rows, columns
- primary keys
- schema thinking
- seed data
- database connection
- SQL `SELECT`
- SQL `INSERT`
- SQL `UPDATE`
- SQL `DELETE`
- async route handlers
- CRUD with PostgreSQL
- admin-style CRUD screens

Do not use:

- authentication
- user-owned data
- complex joins
- advanced authorization
- admin role systems
- file uploads

### Week 7

Teach everything from Week 6, plus:

- signup and login
- users table
- password hashing
- current user idea
- protected routes
- redirects
- auth state
- user IDs
- foreign keys
- user-owned data
- private dashboards
- ownership checks
- `401` vs `403`
- multi-user testing

Do not use:

- OAuth
- password reset
- social login
- complex role systems
- advanced admin permissions
- real email

### Week 8

Teach everything from Week 7, plus:

- full-stack planning
- schema planning
- route planning
- page planning
- user stories
- seed data
- backend validation
- frontend integration
- detail pages
- forms with API
- auth integration
- dashboard integration
- polish and demo prep

Do not use:

- payments
- real email delivery
- real-time chat
- complex admin roles
- advanced state libraries
- complex deployment pipelines

## Still not allowed yet in this phase

Unless the teacher changes the curriculum, keep these out:

- payments
- real email delivery
- real-time chat
- OAuth and social login
- complex admin roles
- advanced state libraries
- advanced backend architecture
- heavy file uploads
- AI features
