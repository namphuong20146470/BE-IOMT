import fs from 'fs';
import request from 'supertest';
import app from './index.js';

const logFile = 'api-test.log';
const latestLogFile = 'api-latest.log';

let latestLogs = '';

function logResult(api, res) {
    const nowVN = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    let body = res.body;

    // Sắp xếp nếu là mảng roles
    if (api === 'GET /actlog/roles' && Array.isArray(body)) {
        body = body.sort((a, b) => a.id_role.localeCompare(b.id_role));
    }
    // Sắp xếp nếu là mảng users (ví dụ theo username)
    if (api === 'GET /actlog/users' && Array.isArray(body)) {
        body = body.sort((a, b) => a.username.localeCompare(b.username));
    }
    // Sắp xếp nếu là mảng logs (ví dụ theo created_at giảm dần)
    if (api === 'GET /actlog/logs' && Array.isArray(body)) {
        body = body.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const log = `
Thời gian VN: ${nowVN}
API: ${api}
Status: ${res.status}
Body:
${JSON.stringify(body, null, 2)}
---------------------------
`;
    fs.appendFileSync(logFile, log);
    latestLogs += log;
}

afterAll(() => {
    fs.writeFileSync(latestLogFile, latestLogs);
});

describe('API Test', () => {
    let token = '';

    beforeAll(async () => {
        // Đăng nhập để lấy token (thay bằng tài khoản có quyền tạo user)
        const loginRes = await request(app)
            .post('/actlog/login')
            .send({
                username: 'admin', // Đổi thành tài khoản hợp lệ của bạn
                password: 'admin123' // Đổi thành mật khẩu hợp lệ
            });
        token = loginRes.body.token;
    });
    //USER TESTS

    let createdUserId = null;

    // Test tạo user mới
    // it('POST /actlog/users', async () => {
    //     const res = await request(app)
    //         .post('/actlog/users')
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             username: 'testuser123',
    //             password: 'testpassword',
    //             full_name: 'Test User',
    //             id_role: 'VT01' // id_role phải đúng với role đã có trong DB
    //         });
    //     logResult('POST /actlog/users', res);
    //     expect(res.status).toBe(201);
    //     expect(res.body).toHaveProperty('id');
    //     expect(res.body.username).toBe('testuser123');
    //     createdUserId = res.body.id; // Lưu lại id để test sửa/xóa
    // });

    // // Test sửa user vừa tạo
    // it('PUT /actlog/users/:id', async () => {
    //     const res = await request(app)
    //         .put(`/actlog/users/${createdUserId}`)
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             username: 'testuser123_updated',
    //             full_name: 'Test User Updated'
    //         });
    //     logResult('PUT /actlog/users/:id', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body.username).toBe('testuser123_updated');
    // });

    // // Test xóa user vừa tạo
    // it('DELETE /actlog/users/:id', async () => {
    //     const res = await request(app)
    //         .delete(`/actlog/users/${createdUserId}`)
    //         .set('Authorization', `Bearer ${token}`);
    //     logResult('DELETE /actlog/users/:id', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body).toHaveProperty('message');
    // });

    //xóa toàn bộ user trừ admin
    // it('POST /actlog/users/all-except-admin', async () => {
    //     const res = await request(app)
    //         .post('/actlog/users/all-except-admin')
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             confirmReset: 'CONFIRM_DELETE_ALL_DATA'
    //         });
    //     logResult('POST /actlog/users/all-except-admin', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body).toHaveProperty('message');
    //     expect(res.body.message).toMatch(/xóa toàn bộ user trừ admin/i);
    // });

    //xóa toàn bộ logs
    // it('POST /actlog/logs/all', async () => {
    //     const res = await request(app)
    //         .post('/actlog/logs/all')
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             confirmReset: 'CONFIRM_DELETE_ALL_DATA'
    //         });
    //     logResult('POST /actlog/logs/all', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body).toHaveProperty('message');
    //     expect(res.body.message).toMatch(/xóa toàn bộ logs/i);
    // });

    //ROLES TESTS

    // Test tạo role mới (nên dùng id_role chưa tồn tại)
    // it('POST /actlog/roles', async () => {
    //     const res = await request(app)
    //         .post('/actlog/roles')
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             name: 'test123case123',
    //             description: 'Te123st Role',
    //             id_role: 'VT99' // id_role mới, chưa có trong DB
    //         });
    //     logResult('POST /actlog/roles', res);
    //     expect(res.status).toBe(201);
    //     expect(res.body).toHaveProperty('id');
    //     expect(res.body.name).toBe('test123case123');
    //     // Lưu lại id_role để test sửa/xóa
    //     global.testRoleId = res.body.id_role;
    // });

    // // Test sửa role vừa tạo
    // it('PUT /actlog/roles/:id_role', async () => {
    //     const res = await request(app)
    //         .put(`/actlog/roles/${global.testRoleId}`)
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             name: 'testcase123_updated',
    //             description: 'Test Role Updated'
    //         });
    //     logResult('PUT /actlog/roles/:id_role', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body.name).toBe('testcase123_updated');
    // });

    // // Test xóa role vừa tạo
    // it('DELETE /actlog/roles/:id_role', async () => {
    //     const res = await request(app)
    //         .delete(`/actlog/roles/${global.testRoleId}`)
    //         .set('Authorization', `Bearer ${token}`);
    //     logResult('DELETE /actlog/roles/:id_role', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body).toHaveProperty('message');
    // });



    //GET ALL LOGS, ROLES, USERS TESTS

    // it('GET /actlog/roles', async () => {
    //     const res = await request(app).get('/actlog/roles');
    //     logResult('GET /actlog/roles', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body)).toBe(true);
    // });

    // it('GET /actlog/users', async () => {
    //     const res = await request(app).get('/actlog/users');
    //     logResult('GET /actlog/users', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body)).toBe(true);
    // });

    // it('GET /actlog/logs', async () => {
    //     const res = await request(app).get('/actlog/logs');
    //     logResult('GET /actlog/logs', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body)).toBe(true);
    // });

    it('GET /iot/warnings', async () => {
        const res = await request(app).get('/iot/warnings');
        logResult('GET /iot/warnings', res);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });


    // it('GET /iot/camera-control/range', async () => {
    //     const res = await request(app).get('/iot/camera-control/range?from=2025-08-05&to=2025-08-06');
    //     logResult('GET /iot/camera-control/range?from=2025-08-05&to=2025-08-06', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('date_range');
    // });

    // // Test các API khoảng thời gian cố định
    // it('GET /iot/camera-control/1hour', async () => {
    //     const res = await request(app).get('/iot/camera-control/1hour');
    //     logResult('GET /iot/camera-control/1hour', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('success');
    //     expect(res.body.success).toBe(true);
    // });

    // it('GET /iot/camera-control/6hours', async () => {
    //     const res = await request(app).get('/iot/camera-control/6hours');
    //     logResult('GET /iot/camera-control/6hours', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('success');
    //     expect(res.body.success).toBe(true);
    // });

    // it('GET /iot/camera-control/24hours', async () => {
    //     const res = await request(app).get('/iot/camera-control/24hours');
    //     logResult('GET /iot/camera-control/24hours', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('success');
    //     expect(res.body.success).toBe(true);
    // });

    // it('GET /iot/camera-control/7days', async () => {
    //     const res = await request(app).get('/iot/camera-control/7days');
    //     logResult('GET /iot/camera-control/7days', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('success');
    //     expect(res.body.success).toBe(true);
    // });

    // it('GET /iot/camera-control/30days', async () => {
    //     const res = await request(app).get('/iot/camera-control/30days');
    //     logResult('GET /iot/camera-control/30days', res);
    //     expect(res.status).toBe(200);
    //     expect(Array.isArray(res.body.data)).toBe(true);
    //     expect(res.body).toHaveProperty('count');
    //     expect(res.body).toHaveProperty('success');
    //     expect(res.body.success).toBe(true);
    // });

    // it('GET /iot/camera-control/latest', async () => {
    //     const res = await request(app).get('/iot/camera-control/latest');
    //     logResult('GET /iot/camera-control/latest', res);
    //     expect(res.status).toBe(200);
    //     expect(res.body).toHaveProperty('data');
    //     expect(res.body.data).toHaveProperty('id');
    //     expect(res.body.data).toHaveProperty('voltage');
    //     expect(res.body.data).toHaveProperty('formatted_time');
    // });


});