# JavaScript Module Structure

This directory contains the modular JavaScript code for the PharmaSight web app, organized by functionality.

## Directory Structure

```
js/
├── components/          # Reusable UI components
│   ├── pharmacyPicker.js    # Pharmacy selection component
│   └── datePicker.js         # Date selection component
├── screens/             # Screen/Page logic
│   ├── dashboard.js          # Dashboard screen
│   └── dailySummary.js       # Daily summary screen
├── services/            # API and external services
│   └── api.js                # API service layer
├── utils/               # Utility functions
│   └── router.js             # Simple routing system
└── app.js               # Main app initialization
```

## Components

### PharmacyPicker (`components/pharmacyPicker.js`)
- Manages pharmacy selection UI
- Handles pharmacy list loading and display
- Stores selected pharmacy in localStorage
- Dispatches `pharmacyChanged` event

### DatePicker (`components/datePicker.js`)
- Manages date selection UI with calendar
- Handles calendar navigation and date selection
- Stores selected date in localStorage
- Dispatches `dateChanged` event

## Screens

### DashboardScreen (`screens/dashboard.js`)
- Main dashboard view
- Displays overview metrics (Turnover, GP, Stock Value, etc.)
- Loads data based on selected pharmacy and date

### DailySummaryScreen (`screens/dailySummary.js`)
- Detailed daily sales view
- Shows daily performance metrics
- Loads data for selected date

## Services

### API Service (`services/api.js`)
- Centralized API calls
- Handles authentication headers
- Provides methods for all API endpoints:
  - `getPharmacies(username)`
  - `getDays(pid, month)`
  - `getMTD(pid, month, through)`
  - `getTargets(pid, month)`
  - `getStockValue(pid, date)`

## Utils

### Router (`utils/router.js`)
- Simple client-side routing
- Handles navigation between screens
- Updates page title and active nav state
- Registers route handlers

## Main App

### App (`app.js`)
- Initializes all components
- Sets up event listeners
- Coordinates between components
- Handles authentication check
- Initializes router and screens

## Usage

All modules are loaded in `index.html` in the correct order:
1. Core services (auth, api)
2. Components (pharmacyPicker, datePicker)
3. Utilities (router)
4. Screens (dashboard, dailySummary)
5. Main app (app.js)

The app automatically initializes when the DOM is ready.

## Adding New Screens

To add a new screen:

1. Create a new file in `js/screens/` (e.g., `monthlySummary.js`)
2. Create a class that implements a `load()` method
3. Register the route in `app.js`:
   ```javascript
   this.router.register('monthly-summary', () => {
       const screen = new MonthlySummaryScreen();
       screen.load();
   });
   ```

## Adding New Components

To add a new component:

1. Create a new file in `js/components/`
2. Create a class with initialization logic
3. Initialize in `app.js` if needed
4. Add script tag to `index.html`


