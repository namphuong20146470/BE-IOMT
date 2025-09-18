# IoT Device API - GroupBy Parameter Guide

## Overview

API hỗ trợ parameter `groupBy` để aggregate dữ liệu theo các khoảng thời gian khác nhau.

## Supported GroupBy Values

### Friendly Names
- `minute` - Group by minute
- `hour` - Group by hour  
- `day` - Group by day

### Technical Intervals
- `1m` - 1 minute intervals
- `1h` - 1 hour intervals
- `6h` - 6 hour intervals  
- `1d` - 1 day intervals

## Usage Examples

### Basic Grouping

#### Group by minute:
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&groupBy=minute
```

#### Group by hour:
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&groupBy=hour
```

#### Group by day:
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&groupBy=day
```

### Using Technical Intervals

#### 1-hour intervals:
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&groupBy=1h
```

## Response Format

### Without GroupBy (Raw Data)
```json
{
    "success": true,
    "data": [
        {
            "id": 31315,
            "voltage": 232.7,
            "current": 0.206,
            "power_operating": 35.7,
            "timestamp": "2025-09-18T13:37:00.000Z",
            "formatted_time": "2025-09-18 13:37:00"
        }
    ],
    "metadata": {
        "total": 150,
        "isAggregated": false
    }
}
```

### With GroupBy (Aggregated Data)
```json
{
    "success": true,
    "data": [
        {
            "timestamp": "2025-09-18T13:00:00.000Z",
            "record_count": 25,
            "voltage": 232.45,
            "current": 0.205,
            "power_operating": 35.6,
            "frequency": 50.0,
            "power_factor": 0.74,
            "period_start": "2025-09-18T13:00:00.000Z",
            "period_end": "2025-09-18T13:59:59.000Z",
            "formatted_time": "2025-09-18 13:00:00"
        }
    ],
    "metadata": {
        "total": 6,
        "timeRange": {
            "start": "2025-09-18T07:37:00Z",
            "end": "2025-09-18T13:37:00Z"
        },
        "groupBy": "hour",
        "aggregation": "avg",
        "isAggregated": true
    }
}
```

## Aggregated Fields

Khi sử dụng `groupBy`, các field số sẽ được aggregate:

### Numeric Fields (Averaged)
- `voltage` - Average voltage trong time period
- `current` - Average current trong time period
- `power_operating` - Average power trong time period
- `frequency` - Average frequency trong time period
- `power_factor` - Average power factor trong time period

### Additional Fields
- `record_count` - Số lượng records trong time period
- `period_start` - Timestamp bắt đầu của period
- `period_end` - Timestamp kết thúc của period
- `timestamp` - Timestamp đại diện cho period (truncated)

## Compatible Parameters

GroupBy có thể combine với các parameters khác:

### With Date Range
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18&endDate=2025-09-19&groupBy=hour
```

### Alternative Parameter Names
API cũng hỗ trợ `interval` thay cho `groupBy`:
```bash
GET /api/iot/auo-display/range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&interval=hour
```

## All Supported Devices

GroupBy hoạt động với tất cả device endpoints:

- `/api/iot/auo-display/range?groupBy=hour`
- `/api/iot/camera-control/range?groupBy=hour`
- `/api/iot/electronic/range?groupBy=hour`
- `/api/iot/led-nova/range?groupBy=hour`
- `/api/iot/iot-env/range?groupBy=hour`

## Error Handling

### Invalid GroupBy Value
```json
{
    "success": false,
    "message": "Invalid groupBy value. Supported: minute, hour, day, 1m, 5m, 15m, 1h, 6h, 1d"
}
```

### Missing Date Range
```json
{
    "success": false,
    "message": "Both startDate and endDate are required"
}
```

## Best Practices

### 1. Choose appropriate groupBy for time range
```bash
# For 6-hour period → use minute or hour
GET /range?startDate=2025-09-18T07:37:00Z&endDate=2025-09-18T13:37:00Z&groupBy=minute

# For 1-day period → use hour
GET /range?startDate=2025-09-18&endDate=2025-09-19&groupBy=hour

# For 1-week period → use day
GET /range?startDate=2025-09-18&endDate=2025-09-25&groupBy=day
```

### 2. Use technical intervals for specific needs
```bash
# Dashboard showing hourly trends
GET /range?startDate=2025-09-18&endDate=2025-09-19&groupBy=1h

# 6-hour shift reports
GET /range?startDate=2025-09-18&endDate=2025-09-19&groupBy=6h
```

### 3. Monitor record counts
Aggregated response includes `record_count` để biết có bao nhiêu raw records được group lại.

## Migration Note

Nếu bạn đang dùng parameter `interval` từ trước, nó vẫn hoạt động:
```bash
# Old way (still works)
GET /range?startDate=...&endDate=...&interval=hour

# New way (recommended)  
GET /range?startDate=...&endDate=...&groupBy=hour
```