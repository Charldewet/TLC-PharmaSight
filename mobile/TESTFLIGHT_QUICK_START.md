# TestFlight Quick Start Guide

## Quick Setup (5 minutes)

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo
```bash
cd mobile
eas login
```

### 3. Initialize Project
```bash
eas init
```
Copy the project ID it gives you and update `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "paste-project-id-here"
  }
}
```

### 4. Build for TestFlight
```bash
eas build --platform ios --profile production
```

### 5. Submit to TestFlight
```bash
eas submit --platform ios --latest
```

## First Time Setup (One-Time)

### Apple Developer Account Setup

1. **Enroll**: https://developer.apple.com/programs/ ($99/year)

2. **Create App ID**:
   - Go to: https://developer.apple.com/account/resources/identifiers/list
   - Create App ID: `com.pharmasight.app`

3. **Create App Store Connect App**:
   - Go to: https://appstoreconnect.apple.com/
   - Create new app: "PharmaSight"
   - Bundle ID: `com.pharmasight.app`

4. **Get IDs**:
   - **Team ID**: https://developer.apple.com/account/ → Membership
   - **App Store Connect App ID**: App Store Connect → Your App → App Information → Apple ID

5. **Update eas.json**:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "your-email@example.com",
         "ascAppId": "1234567890",
         "appleTeamId": "ABCD123456"
       }
     }
   }
   ```

## Common Workflow

### Building a New Version

1. **Update version** in `app.json`:
   ```json
   "version": "1.0.1",  // User-facing version
   "ios": {
     "buildNumber": "2"  // Increment for each build
   }
   ```

2. **Build**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit**:
   ```bash
   eas submit --platform ios --latest
   ```

### Checking Status

```bash
# List builds
eas build:list

# View specific build
eas build:view [build-id]

# List submissions
eas submit:list
```

## Troubleshooting

**Build fails?**
- Check logs: `eas build:view [build-id]`
- Verify `app.json` is valid JSON
- Ensure all dependencies are installed

**Can't submit?**
- Verify Apple ID in `eas.json`
- Check App Store Connect app exists
- Ensure build status is "Ready to Submit"

**Need help?**
- Full guide: See `APP_STORE_SUBMISSION_GUIDE.md`
- Expo docs: https://docs.expo.dev/build/introduction/

