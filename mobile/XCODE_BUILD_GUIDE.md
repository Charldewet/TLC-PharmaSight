# Building & Submitting from Xcode

This guide will help you build and submit PharmaSight directly from Xcode using your existing Apple Developer credentials.

## Prerequisites

- ✅ Xcode installed (latest version recommended)
- ✅ Apple Developer Account with credentials configured
- ✅ CocoaPods installed (`sudo gem install cocoapods`)
- ✅ Node.js and npm installed

## Step 1: Generate Native iOS Project

Run Expo prebuild to generate the native iOS project files:

```bash
cd mobile
npm run prebuild:ios
```

This will:
- Create an `ios/` folder with native Xcode project
- Generate all necessary native configuration files
- Set up CocoaPods dependencies

**Note**: If you already have an `ios/` folder, you may want to delete it first:
```bash
rm -rf ios
npm run prebuild:ios
```

## Step 2: Install CocoaPods Dependencies

```bash
cd ios
pod install
cd ..
```

This installs all native iOS dependencies required by your Expo modules.

## Step 3: Open in Xcode

```bash
open ios/pharmasight-mobile.xcworkspace
```

**Important**: Always open the `.xcworkspace` file, NOT the `.xcodeproj` file!

## Step 4: Configure Signing & Capabilities in Xcode

1. **Select the Project** in the navigator (top item)
2. **Select the Target** (pharmasight-mobile)
3. **Go to "Signing & Capabilities" tab**
4. **Configure Team**:
   - Select your Apple Developer team from the dropdown
   - Xcode will automatically manage provisioning profiles
5. **Verify Bundle Identifier**:
   - Should be: `com.pharmasight.app`
   - If different, update it to match your App Store Connect app

## Step 5: Configure Build Settings

1. **Select the Target** → **Build Settings**
2. **Search for "iOS Deployment Target"**:
   - Set to: `13.0` (or higher)
   - This should already be set from app.json

3. **Verify Version Numbers**:
   - **Marketing Version**: `1.0.0` (from app.json version)
   - **Current Project Version**: `1` (from app.json buildNumber)
   - These are in the "General" tab

## Step 6: Build for Device/Simulator

### For Testing (Simulator)
1. Select a simulator from the device dropdown (top toolbar)
2. Click the **Play** button (▶️) or press `Cmd + R`
3. Wait for build to complete

### For Device Testing
1. Connect your iPhone/iPad via USB
2. Select your device from the device dropdown
3. Make sure your device is trusted (unlock and trust computer)
4. Click the **Play** button (▶️) or press `Cmd + R`
5. On your device, go to Settings → General → VPN & Device Management
6. Trust the developer certificate if prompted

## Step 7: Archive for App Store/TestFlight

1. **Select "Any iOS Device"** from the device dropdown (top toolbar)
   - Don't select a simulator or specific device
   - Select "Any iOS Device (arm64)"

2. **Product → Archive**
   - Or press `Cmd + B` then `Product → Archive`
   - Wait for the archive to complete (5-10 minutes)

3. **Organizer Window Opens**
   - If it doesn't open automatically: `Window → Organizer`
   - You should see your archive listed

## Step 8: Distribute to App Store Connect

1. **In Organizer**, select your archive
2. **Click "Distribute App"**
3. **Choose Distribution Method**:
   - Select **"App Store Connect"**
   - Click **Next**

4. **Distribution Options**:
   - Select **"Upload"** (for TestFlight/App Store)
   - Click **Next**

5. **Distribution Options**:
   - **Automatically manage signing** (recommended)
   - Click **Next**

6. **Review**:
   - Review the summary
   - Click **Upload**

7. **Wait for Upload**:
   - Upload progress will be shown
   - This can take 10-30 minutes depending on your connection
   - You'll see "Upload Successful" when done

## Step 9: Process in App Store Connect

1. **Go to App Store Connect**: https://appstoreconnect.apple.com/
2. **Navigate to your app** → **TestFlight** tab
3. **Wait for Processing**:
   - Your build will appear with status "Processing"
   - This usually takes 10-30 minutes
   - You'll receive an email when it's ready

4. **Once Processed**:
   - Status changes to "Ready to Submit"
   - You can now add it to TestFlight or submit for App Store review

## Step 10: Submit for TestFlight/App Store

### For TestFlight:
1. Go to **TestFlight** tab in App Store Connect
2. **Internal Testing**:
   - Add your build to Internal Testing group
   - Testers will receive an email invitation

3. **External Testing** (Beta):
   - Create an External Testing group
   - Add your build
   - Submit for Beta App Review (required for external testers)

### For App Store:
1. Go to your app → **App Store** tab
2. Click **"+ Version or Platform"** → **iOS**
3. **Select Build**:
   - Choose your processed build from the dropdown
4. **Complete App Information**:
   - Screenshots (required)
   - Description (required)
   - Keywords (required)
   - Support URL (required)
   - Privacy Policy URL (if collecting data)
5. **Submit for Review**

## Troubleshooting

### "No signing certificate found"
- Go to Xcode → Preferences → Accounts
- Add your Apple ID if not already added
- Select your account → Click "Download Manual Profiles"
- Go back to Signing & Capabilities → Select your team

### "Provisioning profile doesn't match"
- In Signing & Capabilities, check "Automatically manage signing"
- Clean build folder: `Product → Clean Build Folder` (Shift + Cmd + K)
- Try archiving again

### "Module not found" or Build Errors
- Make sure you ran `pod install` in the `ios/` folder
- Try: `cd ios && pod deintegrate && pod install`
- Clean build: `Product → Clean Build Folder`

### Archive Button Grayed Out
- Make sure you selected "Any iOS Device" not a simulator
- Check that your target is selected (not the project)

### Upload Fails
- Check your internet connection
- Verify your Apple ID has proper permissions
- Try uploading again (sometimes it's a temporary issue)

## Updating the App

When you make changes and want to build a new version:

1. **Update Version Numbers** in `app.json`:
   ```json
   "version": "1.0.1",  // User-facing version
   "ios": {
     "buildNumber": "2"  // Increment for each build
   }
   ```

2. **Regenerate Native Project** (if you changed app.json):
   ```bash
   npm run prebuild:ios
   cd ios && pod install && cd ..
   ```

3. **Open Xcode** and archive again:
   ```bash
   open ios/pharmasight-mobile.xcworkspace
   ```

4. **Archive and Upload** following steps 7-10 above

## Quick Reference Commands

```bash
# Generate iOS project
npm run prebuild:ios

# Install CocoaPods
cd ios && pod install && cd ..

# Open in Xcode
open ios/pharmasight-mobile.xcworkspace

# Clean build (if needed)
# In Xcode: Product → Clean Build Folder (Shift + Cmd + K)
```

## Notes

- **Always use `.xcworkspace`**, not `.xcodeproj`
- **Run `pod install`** after any `prebuild` or when adding new dependencies
- **Increment buildNumber** for each new build you submit
- **Archive with "Any iOS Device"** selected, not a simulator
- The native `ios/` folder can be regenerated anytime with `prebuild`

## Advantages of Xcode Approach

✅ Full control over build process  
✅ Use your existing Apple Developer credentials  
✅ No need for EAS account  
✅ Can debug native issues directly  
✅ Familiar Xcode interface  
✅ Can test on physical devices easily  

Good luck with your submission! 🚀

