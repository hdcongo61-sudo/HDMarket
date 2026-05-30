# Twilio to Firebase Migration Guide

## Overview

This document describes the migration from Twilio SMS verification to Firebase-based email verification for account confirmation and password reset.

## Changes Made

### Backend Changes

1. **New Verification Code Model** (`backend/models/verificationCodeModel.js`)
   - Stores verification codes in database
   - Supports multiple verification types: registration, password_reset, password_change
   - Auto-expires codes after 10 minutes
   - Tracks usage and attempts

2. **New Firebase Verification Service** (`backend/utils/firebaseVerification.js`)
   - Replaces `twilioVerify.js`
   - Uses nodemailer for sending verification emails
   - Generates 6-digit codes
   - Validates codes with expiration and attempt limits
   - Keeps phone normalization utilities for backward compatibility

3. **Updated Controllers**
   - `authController.js`: Registration and password reset now use email
   - `userController.js`: Password change now uses email
   - All Twilio references removed

4. **Files Status**
   - `backend/utils/twilioVerify.js` - **REPLACED** by `firebaseVerification.js`
   - `backend/utils/twilioMessaging.js` - **STILL USED** for order SMS notifications (in `orderController.js`)
     - If you want to remove this too, update `orderController.js` to remove SMS notifications or replace with email/push notifications

### Frontend Changes

1. **Register Page** (`frontend/src/pages/Register.jsx`)
   - Changed from phone to email for verification
   - Updated UI messages and placeholders

2. **Forgot Password Page** (`frontend/src/pages/ForgotPassword.jsx`)
   - Changed from phone to email for verification
   - Updated UI to use Mail icon instead of Smartphone

3. **Profile Page** (`frontend/src/pages/Profile.jsx`)
   - Updated password change to use email verification
   - Updated UI messages

## Environment Variables

### Old Twilio Variables (REMOVED)
```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_FROM_NUMBER=
```

### New Email Variables (REQUIRED)
```env
EMAIL_SERVICE=gmail          # or 'smtp', 'outlook', etc.
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com  # Optional, defaults to EMAIL_USER
```

## Installation

1. **Install nodemailer** (if not already installed):
```bash
cd backend
npm install nodemailer
```

2. **Remove Twilio** (optional):
```bash
npm uninstall twilio
```

3. **Configure Email**:
   - For Gmail: Use App Password (not regular password)
   - For other providers: Check nodemailer documentation

## API Changes

### Registration Flow

**Before (Twilio):**
```javascript
POST /auth/register/send-code
{ phone: "+242XXXXXXXXX" }

POST /auth/register
{ phone, verificationCode, ... }
```

**After (Firebase/Email):**
```javascript
POST /auth/register/send-code
{ email: "user@example.com" }

POST /auth/register
{ email, verificationCode, ... }
```

### Password Reset Flow

**Before (Twilio):**
```javascript
POST /auth/password/forgot
{ phone: "+242XXXXXXXXX" }

POST /auth/password/reset
{ phone, verificationCode, newPassword }
```

**After (Firebase/Email):**
```javascript
POST /auth/password/forgot
{ email: "user@example.com" }

POST /auth/password/reset
{ email, verificationCode, newPassword }
```

### Password Change Flow

**Before (Twilio):**
```javascript
POST /users/password/send-code
(uses phone from authenticated user)

PUT /users/password
{ verificationCode, newPassword }
```

**After (Firebase/Email):**
```javascript
POST /users/password/send-code
(uses email from authenticated user)

PUT /users/password
{ verificationCode, newPassword }
```

## Email Templates

The verification emails include:
- Professional HTML formatting
- Large, easy-to-read 6-digit code
- Clear instructions
- 10-minute expiration notice
- Security warnings

## Code Storage

- Codes are stored in MongoDB with TTL index
- Auto-deleted after expiration
- Maximum 5 verification attempts per code
- Previous unused codes are invalidated when new code is sent

## Migration Steps

1. ✅ Install nodemailer
2. ✅ Update environment variables
3. ✅ Deploy backend changes
4. ✅ Deploy frontend changes
5. ✅ Test registration flow
6. ✅ Test password reset flow
7. ✅ Test password change flow
8. ⚠️ Remove Twilio package (optional)
9. ⚠️ Remove Twilio environment variables

## Notes

- Phone numbers are still required for user accounts (for other features)
- Email is now used for verification instead of SMS
- Order SMS notifications still use Twilio (in `twilioMessaging.js`)
- If you want to remove order SMS, update `orderController.js` to remove Twilio messaging

## Troubleshooting

### Email Not Sending
1. Check EMAIL_USER and EMAIL_PASSWORD are set
2. For Gmail, use App Password (not regular password)
3. Check email service provider settings
4. Verify firewall/network allows SMTP

### Codes Not Working
1. Check code hasn't expired (10 minutes)
2. Verify code hasn't been used already
3. Check attempt limit (max 5 attempts)
4. Ensure email matches exactly (case-insensitive)

### Database Issues
1. Ensure VerificationCode model is registered
2. Check MongoDB connection
3. Verify TTL index is created

---

**Migration Date**: 2024  
**Status**: ✅ Complete
