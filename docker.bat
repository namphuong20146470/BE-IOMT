# BE-DX - IoT Server Management

## Port Configuration
```powershell
# Open port 3030 for IoT server
netsh advfirewall firewall add rule name="IOT Server 3030" dir=in action=allow protocol=TCP localport=3030
```

## Port Management
```powershell
# Check what's using port 3030
netstat -ano | findstr :3030

# Kill specific process
taskkill /F /PID <PID_NUMBER>

# Kill all processes using port 3030
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3030') do taskkill /F /PID %a
```

## Docker Management
```powershell
# Clean up Docker networks
docker network prune -f

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f iot-server

# Stop services
docker-compose down

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

## PM2 Management
```powershell
# Start with PM2
pm2 start index.js --name "iot-server"

# Stop PM2 services
pm2 stop iot-server

# View logs
pm2 logs iot-server

# Restart service
pm2 restart iot-server

# Delete all PM2 processes
pm2 delete all
```

## Nginx Management
```powershell
# Stop nginx
taskkill /F /IM nginx.exe /T

# Start nginx
.\nginx.exe

# Reload nginx configuration
.\nginx.exe -s reload

# Stop nginx gracefully
.\nginx.exe -s quit
```

## Service Cleanup (if needed)
```powershell
# Stop all services
pm2 stop all
pm2 delete all
docker stop $(docker ps -q)
taskkill /F /IM nginx.exe /T

# Clean Docker
docker system prune -f
docker network prune -f
```

## Development Workflow
```powershell
# 1. Stop existing services
docker-compose down
pm2 delete all

# 2. Start with Docker
docker-compose up --build -d

# 3. Check logs
docker-compose logs -f iot-server

# 4. Access server
# http://192.168.0.252:3030