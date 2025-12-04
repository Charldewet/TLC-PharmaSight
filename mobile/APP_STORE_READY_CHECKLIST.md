# PharmaSight App Store Readiness Checklist

## ✅ Configuration Files Created/Updated

- [x] **eas.json** - EAS build configuration created
- [x] **app.json** - Updated with iOS App Store requirements:
  - [x] Bundle identifier: `com.pharmasight.app`
  - [x] Build number: `1`
  - [x] Deployment target: iOS 13.0+
  - [x] Privacy descriptions added
  - [x] Encryption compliance flag set
- [x] **package.json** - Added EAS build scripts and eas-cli dependency

## 📋 Next Steps (In Order)

### 1. Install EAS CLI
```bash
npm install -g eas-cli
cd mobile
npm install
```

### 2. Create Expo Account & Initialize Project
```bash
eas login
eas init
```
**Important**: Copy the project ID and update `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "your-project-id-here"
  }
}
```

### 3. Apple Developer Account Setup
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Create App ID: `com.pharmasight.app`
- [ ] Create App Store Connect app: "PharmaSight"
- [ ] Get Team ID from Apple Developer account
- [ ] Get App Store Connect App ID
- [ ] Update `eas.json` with your Apple IDs

### 4. Prepare App Assets
- [ ] App icon: 1024x1024 PNG (no transparency)
  - Current: `mobile/assets/logo.png`
  - Verify it's high quality and square
- [ ] Screenshots for App Store:
  - [ ] iPhone 6.7" (1290 x 2796)
  - [ ] iPhone 6.5" (1242 x 2688)
  - [ ] iPhone 5.5" (1242 x 2208)
  - [ ] iPad Pro 12.9" (2048 x 2732)
- [ ] App preview video (optional but recommended)

### 5. App Store Connect Information
- [ ] App description written
- [ ] Keywords selected
- [ ] Support URL ready
- [ ] Privacy Policy URL ready (if collecting user data)
- [ ] Category selected (Business/Productivity)
- [ ] Pricing set (Free or paid)

### 6. Build & Submit
- [ ] Build production version: `eas build --platform ios --profile production`
- [ ] Wait for build to complete (~15-20 minutes)
- [ ] Submit to TestFlight: `eas submit --platform ios --latest`
- [ ] Configure TestFlight testers
- [ ] Submit for App Store review

## 🔍 Pre-Submission Testing

Before building, ensure:
- [ ] App runs without crashes
- [ ] All features work correctly
- [ ] Login/authentication works
- [ ] API connections work in production
- [ ] UI looks good on different screen sizes
- [ ] No console errors or warnings

## 📝 Important Notes

1. **Version Numbers**: 
   - `version` in app.json = user-facing version (e.g., "1.0.0")
   - `buildNumber` in app.json iOS = build number (increment for each build)

2. **Privacy**: 
   - If your app collects any user data, you MUST provide a privacy policy URL
   - Answer App Privacy questions accurately in App Store Connect

3. **API Configuration**:
   - Ensure production API URL is configured in `src/config/api.js`
   - Test that production backend is accessible

4. **Encryption**:
   - Currently set to `usesNonExemptEncryption: false`
   - If you use encryption beyond standard HTTPS, update this

## 📚 Documentation

- **Full Guide**: `APP_STORE_SUBMISSION_GUIDE.md`
- **Quick Start**: `TESTFLIGHT_QUICK_START.md`
- **Expo Docs**: https://docs.expo.dev/build/introduction/

## 🚀 Quick Commands Reference

```bash
# Build for production
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Check build status
eas build:list

# View build details
eas build:view [build-id]
```

## ⚠️ Common Issues

1. **"Project ID not found"**: Run `eas init` and update app.json
2. **"Invalid bundle identifier"**: Ensure it matches App Store Connect
3. **"Build failed"**: Check build logs with `eas build:view [build-id]`
4. **"Submission failed"**: Verify Apple ID credentials in eas.json

---

**Status**: Configuration complete ✅  
**Next**: Follow steps 1-6 above to submit to App Store

