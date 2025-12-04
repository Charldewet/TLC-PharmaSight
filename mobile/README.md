# PharmaSight Mobile App

React Native mobile application for PharmaSight pharmacy analytics platform.

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Studio (for Android development)

### Installation

1. Navigate to the mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Configure API endpoint:
   - Open `src/config/api.js`
   - Update `API_BASE_URL` to match your backend URL
   - For local development: `http://localhost:8000`
   - For production: Your deployed backend URL

### Running the App

#### iOS Simulator (Mac only)
```bash
npm run ios
```

#### Android Emulator
```bash
npm run android
```

#### Web (for testing)
```bash
npm run web
```

#### Start Expo development server
```bash
npm start
```
Then scan the QR code with Expo Go app on your phone.

## Backend Modifications

✅ **Already implemented!** The backend has been updated with mobile-friendly endpoints:

- `/api/mobile/login` - Returns token in JSON format for mobile apps
- `/api/mobile/pharmacies` - Returns user's pharmacies list

These endpoints are already added to `app/main.py` and work alongside the existing web endpoints.

## Project Structure

```
mobile/
├── App.js                 # Main app entry point
├── app.json              # Expo configuration
├── package.json          # Dependencies
├── src/
│   ├── config/
│   │   └── api.js        # API configuration
│   ├── context/
│   │   └── AuthContext.js # Authentication context
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   └── DashboardScreen.js
│   └── services/
│       └── api.js        # API service functions
```

## Features Implemented

- ✅ Login screen with beautiful UI matching web design
- ✅ Dashboard screen with pharmacy selection
- ✅ Authentication context with token storage
- ✅ API client for backend communication
- ✅ Navigation between screens

## Next Steps

- Add more dashboard features (charts, summaries, etc.)
- Implement other screens (Daily Summary, Monthly Summary, etc.)
- Add error handling and loading states
- Implement offline support
- Add push notifications
- Add biometric authentication

## Troubleshooting

### Metro bundler issues
```bash
npx expo start --clear
```

### iOS build issues
```bash
cd ios && pod install && cd ..
```

### Android build issues
Make sure Android SDK is properly configured and emulator is running.

