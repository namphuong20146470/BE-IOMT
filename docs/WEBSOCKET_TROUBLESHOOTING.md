# WebSocket/MQTT Connection Troubleshooting

## 🔍 Problem: Local works, Production HTTPS doesn't receive MQTT data

### Root Cause: **Mixed Content Security**
- ✅ **Local (HTTP)**: `http://` → `ws://` (WebSocket) → Works
- ❌ **Production (HTTPS)**: `https://` → `ws://` (WebSocket) → **BLOCKED by browser**
- ✅ **Solution**: `https://` → `wss://` (WebSocket Secure)

---

## ✅ Fixes Applied

### 1. Enhanced Socket.IO Configuration
**File:** `index.js`

```javascript
// HTTPS with secure WebSocket (WSS)
io = new Server(httpsServer, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'], // Fallback support
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8
});
```

**Key improvements:**
- ✅ `transports: ['websocket', 'polling']` - Fallback if WSS fails
- ✅ `pingTimeout: 60000` - Keep connection alive
- ✅ `maxHttpBufferSize: 1e8` - Support large MQTT payloads

---

## 🧪 Testing

### Test WebSocket Connection:
```bash
# Test local (HTTP/WS)
node scripts/test-websocket-connection.js local

# Test production (HTTPS/WSS)
node scripts/test-websocket-connection.js production
```

### Expected Results:
```
✅ Connected successfully!
Socket ID: abc123xyz
Transport: websocket
```

---

## 🔧 Production Checklist

### 1. **SSL Certificates**
```bash
# Verify certificates exist
ls -la /path/to/certs/
# Should have:
# - certificate.crt
# - private.key
```

### 2. **Firewall/Security Groups**
- ✅ Port 3030 (HTTPS) - OPEN
- ✅ WebSocket upgrade headers - ALLOWED
- ✅ CORS headers - Configured

### 3. **Nginx/Reverse Proxy** (if using)
```nginx
location / {
    proxy_pass http://localhost:3030;
    proxy_http_version 1.1;
    
    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

### 4. **Environment Variables**
```env
NODE_ENV=production
USE_HTTPS=true
PORT=3030

# CORS
ALLOWED_ORIGINS=https://iomt.hoangphucthanh.vn,https://www.iomt.hoangphucthanh.vn
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "WebSocket connection failed"
**Cause:** Browser blocking non-secure WebSocket from HTTPS page

**Solution:**
- ✅ Ensure backend uses HTTPS with valid certificate
- ✅ Frontend connects to `wss://` not `ws://`

### Issue 2: "CORS error on WebSocket handshake"
**Cause:** Origin not in allowedOrigins

**Solution:**
```javascript
const allowedOrigins = [
  'https://iomt.hoangphucthanh.vn',
  'https://www.iomt.hoangphucthanh.vn'
];
```

### Issue 3: "Connection timeout"
**Cause:** Firewall blocking WebSocket upgrade

**Solution:**
- Check security group rules
- Allow TCP traffic on port 3030
- Allow HTTP upgrade headers

### Issue 4: "Invalid certificate"
**Cause:** Self-signed or expired certificate

**Solution:**
```javascript
// Development only!
const socket = io(url, {
    rejectUnauthorized: false
});
```

---

## 📊 Monitoring

### Check active Socket.IO connections:
```javascript
// In your app
console.log('Active sockets:', io.sockets.sockets.size);

io.on('connection', (socket) => {
    console.log('Client connected:', {
        id: socket.id,
        transport: socket.conn.transport.name,
        remoteAddress: socket.handshake.address
    });
});
```

### Browser Console Check:
```javascript
// Frontend
const socket = io('https://iomt.hoangphucthanh.vn', {
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection error:', err.message);
});
```

---

## 🔐 Security Recommendations

### Production:
1. ✅ Use valid SSL certificates (Let's Encrypt)
2. ✅ Enable HTTPS only mode
3. ✅ Set strict CORS origins
4. ✅ Use secure WebSocket (WSS)
5. ✅ Enable rate limiting
6. ✅ Monitor connection metrics

### Development:
1. ⚠️ Can use self-signed certs
2. ⚠️ Can disable `rejectUnauthorized`
3. ✅ Still test with HTTPS locally

---

## 📝 Next Steps

1. **Deploy updated code to production**
2. **Restart backend service**
3. **Clear browser cache**
4. **Test connection from frontend**
5. **Monitor logs for errors**

---

## 🆘 Still Having Issues?

Check these logs:
```bash
# Backend logs
pm2 logs iomt-backend

# Nginx logs (if using)
tail -f /var/log/nginx/error.log

# System logs
journalctl -u iomt-backend -f
```

**Common error patterns:**
- `ECONNREFUSED` → Backend not running
- `CORS error` → Origin not allowed
- `Certificate error` → Invalid/expired cert
- `Timeout` → Firewall blocking
