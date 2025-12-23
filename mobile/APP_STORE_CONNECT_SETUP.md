# Setting Up App Store Connect for PharmaSight

## Step 1: Create App ID in Apple Developer Portal

1. **Go to Apple Developer Portal**
   - Visit: https://developer.apple.com/account/resources/identifiers/list
   - Sign in with your Apple Developer account

2. **Create New App ID**
   - Click the **"+"** button (top left)
   - Select **"App IDs"** → Click **Continue**

3. **Configure App ID**
   - Select **"App"** (not App Clip or other)
   - Click **Continue**

4. **Enter Details**
   - **Description**: `PharmaSight`
   - **Bundle ID**: Select **"Explicit"**
   - **Bundle ID**: Enter `com.pharmasight.app`
   - **Capabilities**: 
     - You can enable capabilities later if needed
     - For now, you can leave defaults or enable:
       - Push Notifications (if you plan to use them)
   - Click **Continue**

5. **Review and Register**
   - Review your settings
   - Click **Register**
   - You should see "Registration complete"

## Step 2: Create App in App Store Connect

1. **Go to App Store Connect**
   - Visit: https://appstoreconnect.apple.com/
   - Sign in with your Apple Developer account

2. **Navigate to My Apps**
   - Click **"My Apps"** in the top navigation
   - Click the **"+"** button (top left)
   - Select **"New App"**

3. **Fill in App Information**
   - **Platform**: Select **iOS**
   - **Name**: `PharmaSight`
   - **Primary Language**: Select your language (e.g., English)
   - **Bundle ID**: Select `com.pharmasight.app` from the dropdown
     - If it doesn't appear, make sure you completed Step 1 first
   - **SKU**: `pharmasight-ios` (this is a unique identifier, can be anything)
   - **User Access**: 
     - **Full Access** (if you're the only developer)
     - Or select specific users if you have a team

4. **Create App**
   - Click **"Create"**
   - You'll be taken to your app's dashboard

## Step 3: Verify Your App is Set Up

After creating the app, you should see:

- ✅ App appears in "My Apps" list
- ✅ App Information page shows:
  - App Name: PharmaSight
  - Bundle ID: com.pharmasight.app
  - SKU: pharmasight-ios

## Step 4: Get Your App Store Connect App ID

You'll need this for future reference:

1. In App Store Connect, go to your app
2. Look at the URL: `https://appstoreconnect.apple.com/apps/[APP_ID]/...`
   - The number in the URL is your App Store Connect App ID
3. Or go to **App Information** → **General Information**
   - Find **Apple ID** (this is your App Store Connect App ID)

## Step 5: Get Your Team ID

1. Go to: https://developer.apple.com/account/
2. Click **"Membership"** in the sidebar
3. Find your **Team ID** (10-character string like `ABCD123456`)

## Step 6: Update eas.json (Optional - if using EAS)

If you plan to use EAS Build later, update `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-email@example.com",
      "ascAppId": "1234567890",  // Your App Store Connect App ID
      "appleTeamId": "ABCD123456"  // Your Team ID
    }
  }
}
```

## Troubleshooting

### "Bundle ID not found" in App Store Connect
- Make sure you created the App ID in Apple Developer Portal first (Step 1)
- Wait a few minutes for it to sync
- Refresh the page

### "Bundle ID already exists"
- Someone else may have registered it
- You'll need to use a different bundle ID
- Update `app.json` with the new bundle ID
- Example: `com.yourcompany.pharmasight.app`

### Can't see "New App" button
- Make sure you have the right permissions
- You need Admin or App Manager role
- Contact your account administrator

## Next Steps

Once your app is created in App Store Connect:

1. ✅ You can now build and upload from Xcode
2. ✅ Archive your app in Xcode
3. ✅ Upload to App Store Connect
4. ✅ Set up TestFlight testing
5. ✅ Prepare App Store listing

## Quick Checklist

- [ ] App ID created in Apple Developer Portal (`com.pharmasight.app`)
- [ ] App created in App Store Connect
- [ ] Bundle ID matches in both places
- [ ] Team ID noted down
- [ ] App Store Connect App ID noted down

You're all set! 🚀

