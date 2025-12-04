# PharmaSight App Store Submission Guide

This guide will walk you through submitting PharmaSight to the iOS App Store and TestFlight.

## Prerequisites

1. **Apple Developer Account**
   - Enroll in the Apple Developer Program ($99/year)
   - Visit: https://developer.apple.com/programs/
   - You'll need your Apple ID and payment method

2. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

3. **Install Dependencies**
   ```bash
   cd mobile
   npm install
   ```

## Step 1: Create Expo Account and Link Project

1. **Create Expo Account** (if you don't have one)
   ```bash
   eas login
   ```
   Or sign up at: https://expo.dev/signup

2. **Initialize EAS Project**
   ```bash
   cd mobile
   eas init
   ```
   This will create a project ID and link it to your Expo account.

3. **Update app.json**
   - After running `eas init`, it will generate a project ID
   - Copy the project ID and update `app.json`:
   ```json
   "extra": {
     "eas": {
       "projectId": "your-actual-project-id-here"
     }
   }
   ```

## Step 2: Configure Apple Developer Account

1. **Create App Identifier**
   - Go to https://developer.apple.com/account/resources/identifiers/list
   - Click "+" to create a new App ID
   - Select "App IDs" → Continue
   - Select "App"
   - Description: "PharmaSight"
   - Bundle ID: `com.pharmasight.app` (must match app.json)
   - Capabilities: Enable any needed (Push Notifications, if you plan to use them)
   - Register

2. **Create App Store Connect App**
   - Go to https://appstoreconnect.apple.com/
   - Click "My Apps" → "+" → "New App"
   - Platform: iOS
   - Name: PharmaSight
   - Primary Language: English (or your preferred language)
   - Bundle ID: Select `com.pharmasight.app`
   - SKU: pharmasight-ios (unique identifier, can be anything)
   - User Access: Full Access (or as needed)
   - Create

3. **Get Your App Store Connect App ID**
   - In App Store Connect, go to your app
   - Look at the URL: `https://appstoreconnect.apple.com/apps/[APP_ID]/...`
   - Or go to App Information → General Information → Apple ID
   - Copy this ID

4. **Get Your Team ID**
   - Go to https://developer.apple.com/account/
   - Click on "Membership" in the sidebar
   - Find your "Team ID" (10-character string)

5. **Update eas.json**
   - Open `mobile/eas.json`
   - Update the submit section with your actual values:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "your-apple-id@example.com",
         "ascAppId": "1234567890",
         "appleTeamId": "ABCD123456"
       }
     }
   }
   ```

## Step 3: Prepare App Assets

### App Icon
- Your app icon should be 1024x1024 pixels
- Format: PNG (no transparency)
- Location: `mobile/assets/logo.png`
- Make sure it's square and high quality

### Screenshots (Required for App Store)
You'll need screenshots for different device sizes:
- iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max): 1290 x 2796 pixels
- iPhone 6.5" (iPhone 11 Pro Max, XS Max): 1242 x 2688 pixels
- iPhone 5.5" (iPhone 8 Plus): 1242 x 2208 pixels
- iPad Pro 12.9": 2048 x 2732 pixels

Take screenshots of your app's key screens:
- Login screen
- Dashboard
- Main features

### App Preview Video (Optional but Recommended)
- 15-30 seconds showcasing your app
- Format: MP4 or MOV
- Max file size: 500MB

## Step 4: Build for TestFlight

1. **Build iOS App**
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```

2. **Follow the Prompts**
   - EAS will ask if you want to create credentials (say yes)
   - It will handle certificate generation automatically
   - The build will take 10-20 minutes
   - You'll get a build URL to track progress

3. **Wait for Build to Complete**
   - Check status: `eas build:list`
   - Or visit: https://expo.dev/accounts/[your-account]/projects/pharmasight-mobile/builds

## Step 5: Submit to TestFlight

### Option A: Automatic Submission (Recommended)

1. **Submit Automatically After Build**
   ```bash
   eas submit --platform ios --latest
   ```
   This will submit the most recent build to App Store Connect.

### Option B: Manual Submission

1. **Download the Build**
   - Visit your build page on expo.dev
   - Download the `.ipa` file

2. **Upload via Transporter**
   - Download Apple Transporter from Mac App Store
   - Open Transporter
   - Drag and drop your `.ipa` file
   - Click "Deliver"

3. **Or Upload via Xcode**
   - Open Xcode
   - Window → Organizer
   - Click "+" → Add
   - Select your `.ipa` file
   - Click "Distribute App"
   - Follow the wizard

## Step 6: Configure TestFlight

1. **Go to App Store Connect**
   - Navigate to your app → TestFlight tab

2. **Add Test Information**
   - What to Test: Brief description of what testers should focus on
   - Description: More detailed testing instructions

3. **Add Internal Testers**
   - Go to Internal Testing
   - Add team members (up to 100)
   - They'll receive an email invitation

4. **Add External Testers (Beta Testing)**
   - Go to External Testing
   - Create a new group
   - Add testers (up to 10,000)
   - Submit for Beta App Review (required for external testers)
   - This review takes 24-48 hours

## Step 7: Prepare App Store Listing

1. **App Information**
   - App Name: PharmaSight
   - Subtitle: (Optional) Brief tagline
   - Category: Business / Productivity
   - Content Rights: Confirm you have rights to all content

2. **Pricing and Availability**
   - Price: Free (or set your price)
   - Availability: Select countries

3. **App Privacy**
   - Go to App Privacy section
   - Answer questions about data collection
   - Since PharmaSight connects to APIs, you'll need to specify:
     - Data types collected (if any)
     - Data usage purposes
     - Data linked to user identity

4. **App Store Information**
   - Description: Write compelling app description
   - Keywords: Relevant keywords (comma-separated)
   - Support URL: Your support website
   - Marketing URL: (Optional) Marketing website
   - Privacy Policy URL: Required if you collect data

5. **Version Information**
   - What's New in This Version: Release notes
   - Screenshots: Upload screenshots for each device size
   - App Preview: (Optional) Upload video

## Step 8: Submit for App Store Review

1. **Create a New Version**
   - In App Store Connect, go to your app
   - Click "+ Version or Platform"
   - Select iOS
   - Enter version number: 1.0.0

2. **Complete All Required Fields**
   - Screenshots (required)
   - Description (required)
   - Keywords (required)
   - Support URL (required)
   - Privacy Policy URL (if collecting data)

3. **Select Build**
   - Go to Build section
   - Select your production build
   - If you don't see it, wait a few minutes and refresh

4. **Submit for Review**
   - Review all information
   - Click "Submit for Review"
   - Answer any export compliance questions
   - Confirm submission

## Step 9: Review Process

1. **Waiting for Review**
   - Status: "Waiting for Review"
   - Usually takes 24-48 hours
   - You'll receive email updates

2. **In Review**
   - Status: "In Review"
   - Usually takes a few hours to 1 day

3. **Possible Outcomes**
   - **Approved**: Your app is live! 🎉
   - **Rejected**: You'll receive feedback. Fix issues and resubmit.
   - **Metadata Rejected**: Fix listing issues and resubmit.

## Step 10: After Approval

1. **Release**
   - If you set "Automatic Release": App goes live immediately
   - If "Manual Release": Click "Release This Version" when ready

2. **Monitor**
   - Check App Store Connect for analytics
   - Monitor reviews and ratings
   - Respond to user feedback

## Troubleshooting

### Build Fails
- Check build logs: `eas build:view [build-id]`
- Ensure all dependencies are compatible
- Verify app.json is valid JSON

### Submission Fails
- Verify Apple ID credentials
- Check that App Store Connect app exists
- Ensure build is in "Ready to Submit" status

### App Rejected
- Read rejection reason carefully
- Common issues:
  - Missing privacy policy
  - Incomplete app information
  - App crashes or bugs
  - Guideline violations
- Fix issues and resubmit

## Useful Commands

```bash
# Check build status
eas build:list

# View specific build
eas build:view [build-id]

# Cancel a build
eas build:cancel [build-id]

# Check submission status
eas submit:list

# Update app version
# Edit app.json: "version": "1.0.1"
# Edit app.json iOS: "buildNumber": "2"
```

## Version Management

When updating your app:

1. **Update Version Numbers**
   - `app.json`: `"version": "1.0.1"` (user-facing version)
   - `app.json` iOS: `"buildNumber": "2"` (build number, increment each build)

2. **Build New Version**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit Update**
   ```bash
   eas submit --platform ios --latest
   ```

## Additional Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Expo Submission Guide](https://docs.expo.dev/submit/introduction/)

## Checklist

Before submitting, ensure:

- [ ] Apple Developer Account active
- [ ] App Store Connect app created
- [ ] App icon is 1024x1024 PNG
- [ ] Screenshots prepared for all required sizes
- [ ] App description written
- [ ] Privacy policy URL ready (if needed)
- [ ] Support URL ready
- [ ] App tested thoroughly
- [ ] Version numbers set correctly
- [ ] eas.json configured with correct IDs
- [ ] Build completed successfully
- [ ] All required App Store Connect fields completed

Good luck with your submission! 🚀

