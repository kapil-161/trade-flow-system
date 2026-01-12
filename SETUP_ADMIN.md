# How to Set First Admin

## Method 1: Using Browser Console (After Deployment)

1. **Make sure you're logged into** https://trade-flow-app.onrender.com
2. **Open Browser Console** (F12 → Console tab)
3. **Type `allow pasting`** and press Enter (to allow pasting)
4. **Paste this code:**

```javascript
fetch('/api/setup/first-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ username: 'kapil.bhattarai.161@gmail.com' })
})
.then(res => res.json())
.then(data => {
  console.log('Result:', data);
  if (data.success) {
    alert('Admin set successfully! Refreshing...');
    window.location.href = '/admin';
  } else {
    alert('Error: ' + data.error);
  }
})
.catch(err => {
  console.error('Error:', err);
  alert('Error: ' + err.message);
});
```

5. **Press Enter** to run
6. **Refresh the admin page** or navigate to `/admin`

## Method 2: Using curl (Terminal)

```bash
curl -X POST https://trade-flow-app.onrender.com/api/setup/first-admin \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"username":"kapil.bhattarai.161@gmail.com"}'
```

## Method 3: Using Postman or Similar Tool

- **URL:** `https://trade-flow-app.onrender.com/api/setup/first-admin`
- **Method:** POST
- **Headers:** 
  - `Content-Type: application/json`
  - `Cookie: connect.sid=YOUR_SESSION_COOKIE` (get this from browser dev tools)
- **Body (JSON):**
```json
{
  "username": "kapil.bhattarai.161@gmail.com"
}
```

## Troubleshooting

### If you get 404:
- Wait a few minutes for Render to finish deploying
- Check Render dashboard to see if deployment is complete
- Make sure you're using POST method, not GET

### If you get 403 "Admin already exists":
- An admin already exists in the database
- You'll need to use the admin panel to manage users (if you have access)
- Or manually update the database

### If you get 404 "User not found":
- Make sure the username is exactly: `kapil.bhattarai.161@gmail.com`
- Check that you've registered/login with this username

### If credentials don't work:
- Make sure you're logged into the site first
- The endpoint requires you to be authenticated
- Try logging out and logging back in first

## After Setting Admin:

1. **Refresh the admin page** (`/admin`)
2. **Or log out and log back in** to refresh your session
3. You should now see the admin panel with user management
