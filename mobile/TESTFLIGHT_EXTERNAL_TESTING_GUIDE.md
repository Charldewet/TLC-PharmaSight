# TestFlight External Testing Guide

This guide explains how to share your PharmaSight app with external testers (users outside your internal team).

## Overview

TestFlight has two types of testing:
- **Internal Testing**: Up to 100 team members (instant access, no review)
- **External Testing**: Up to 10,000 testers (requires Beta App Review, takes 24-48 hours)

## Step 1: Prepare Your Build

1. **Archive and Upload** your app to App Store Connect (as you did before)
2. **Wait for Processing**: Your build will show as "Processing" in TestFlight
3. **Wait for "Ready to Submit"**: This usually takes 10-30 minutes

## Step 2: Create an External Testing Group

1. **Go to App Store Connect**
   - Visit: https://appstoreconnect.apple.com/
   - Navigate to your **PharmaSight** app
   - Click on the **TestFlight** tab

2. **Create External Testing Group**
   - Scroll down to **External Testing** section
   - Click **"+"** button (or "Create a group to test your app")
   - Enter a group name: e.g., "Beta Testers" or "Public Beta"
   - Click **"Create"**

## Step 3: Add Your Build to External Testing

1. **Select Your Group**
   - Click on your newly created external testing group
   - Click **"+"** next to "Builds" (or "Add Build to Test")

2. **Choose Your Build**
   - Select the build you want to test (should be "Ready to Submit")
   - Click **"Next"**

3. **Add Test Information** (Required for Beta App Review)
   - **What to Test**: Brief description of what testers should focus on
     - Example: "Test the login flow, dashboard features, and stock management tools"
   - **Description**: More detailed testing instructions
     - Example: "Please test all major features including login, pharmacy selection, dashboard navigation, and report generation. Report any bugs or issues you encounter."
   - Click **"Next"**

4. **Review Information**
   - Review your test information
   - Click **"Submit for Review"**

## Step 4: Beta App Review Process

1. **Review Status**
   - Your build will show as "Waiting for Review" or "In Review"
   - This typically takes **24-48 hours**
   - You'll receive an email when the review is complete

2. **Possible Outcomes**
   - **Approved**: Your build is ready for external testing! ✅
   - **Rejected**: You'll receive feedback. Fix issues and resubmit.

## Step 5: Add External Testers

Once your build is approved:

### Option A: Add Testers by Email

1. **Go to Your External Testing Group**
   - In TestFlight, click on your external testing group
   - Click **"+"** next to "Testers"

2. **Add Email Addresses**
   - Enter email addresses (one per line or comma-separated)
   - You can add up to 10,000 testers
   - Click **"Add"**

3. **Testers Receive Invitation**
   - Testers will receive an email invitation
   - They need to:
     - Click the link in the email
     - Sign in with their Apple ID
     - Install TestFlight app (if not already installed)
     - Accept the invitation

### Option B: Public Link (Recommended for Many Testers)

1. **Enable Public Link**
   - In your external testing group
   - Toggle **"Enable Public Link"** to ON
   - Copy the public link (e.g., `https://testflight.apple.com/join/ABC123XYZ`)

2. **Share the Link**
   - Share this link via:
     - Email
     - Website
     - Social media
     - QR code
   - Anyone with the link can join (up to 10,000 testers)

3. **Testers Join**
   - Testers click the link
   - Sign in with Apple ID
   - Install TestFlight app
   - Accept invitation

## Step 6: Testers Install Your App

1. **Testers Need**:
   - iOS device (iPhone/iPad)
   - TestFlight app (free from App Store)
   - Apple ID

2. **Installation Steps**:
   - Open TestFlight app
   - Tap on your app (PharmaSight)
   - Tap **"Install"** or **"Update"**
   - App installs like a normal app

## Important Notes

### Beta App Review Requirements

Apple reviews external TestFlight builds similar to App Store submissions. Make sure:

- ✅ App doesn't crash
- ✅ All features work correctly
- ✅ No placeholder content
- ✅ Privacy policy URL is provided (if collecting data)
- ✅ App follows App Store Review Guidelines

### Limitations

- **External Testing**: Requires Beta App Review (24-48 hours)
- **Build Expiration**: TestFlight builds expire after 90 days
- **Tester Limit**: Maximum 10,000 external testers
- **Version Limit**: Can only have 1 external testing build per version

### Updating External Testers

When you upload a new build:

1. Upload new build to TestFlight
2. Wait for processing
3. Add new build to your external testing group
4. Submit for Beta App Review again (if it's a new version)
5. Testers will see update notification in TestFlight

### Removing Testers

- Go to your external testing group
- Click on "Testers" tab
- Remove individual testers or disable public link

## Quick Checklist

- [ ] Build uploaded and processed in TestFlight
- [ ] External testing group created
- [ ] Build added to external testing group
- [ ] Test information filled out
- [ ] Submitted for Beta App Review
- [ ] Beta App Review approved
- [ ] Testers added (email or public link)
- [ ] Testers received invitations
- [ ] Testers installed app via TestFlight

## Troubleshooting

### "Build Not Available for External Testing"
- Make sure build status is "Ready to Submit"
- Check that you've completed all required App Store Connect information
- Verify your app doesn't have any compliance issues

### Testers Can't See the App
- Check that Beta App Review is approved
- Verify testers accepted the invitation
- Make sure testers are using the same Apple ID they used to accept invitation

### Public Link Not Working
- Verify public link is enabled
- Check that you haven't reached 10,000 tester limit
- Make sure Beta App Review is approved

## Best Practices

1. **Test Information**: Be clear about what to test
2. **Communication**: Set up a way for testers to provide feedback (email, form, etc.)
3. **Updates**: Keep testers informed about new builds
4. **Feedback**: Actively collect and respond to tester feedback
5. **Privacy**: Make sure you have a privacy policy if collecting user data

## Next Steps After Testing

Once you've gathered feedback from external testers:

1. Fix any bugs or issues
2. Update your app
3. Upload new build
4. Submit for App Store review (when ready)
5. Release to App Store

---

**Need Help?**
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

