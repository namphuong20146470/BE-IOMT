import express from 'express';

import {
    getAllAuoDisplay,
    getLatestAuoDisplay,
    addAuoDisplay,
    getAuoDisplay1Hour,
    getAuoDisplay6Hours,
    getAuoDisplay24Hours,
    getAuoDisplay7Days,
    getAuoDisplay30Days,
    getAuoDisplayByDateRange
} from '../controllers/auoDisplay/auoDisplay.controller.js';

import {
    getAllCameraControl,
    getLatestCameraControl,
    addCameraControl,
    getCameraControl7Days,
    getCameraControl30Days,
    getCameraControlByDateRange,
    getCameraControl1Hour,
    getCameraControl6Hours,
    getCameraControl24Hours
} from '../controllers/cameraControl/cameraControl.controller.js';

import {
    getAllElectronic,
    getLatestElectronic,
    addElectronic,
    getElectronic1Hour,
    getElectronic6Hours,
    getElectronic24Hours,
    getElectronic7Days,
    getElectronic30Days,
    getElectronicByDateRange
} from '../controllers/electronic/electronic.controller.js';

import {
    getAllLedNova,
    getLatestLedNova,
    addLedNova,
    getLedNova1Hour,
    getLedNova6Hours,
    getLedNova24Hours,
    getLedNova7Days,
    getLedNova30Days,
    getLedNovaByDateRange
} from '../controllers/ledNova/ledNova.controller.js';

import {
    getAllIotEnv,
    getLatestIotEnv,
    addIotEnv,
    getIotEnv1Hour,
    getIotEnv6Hours,
    getIotEnv24Hours,
    getIotEnv7Days,
    getIotEnv30Days,
    getIotEnvByDateRange
} from '../controllers/iotEnv/iotEnv.controller.js';

import {
    getAllWarningLogs,
    getLatestWarningLogs,
    getActiveWarnings,
    acknowledgeWarning,
    resolveWarning,
    getWarningStatistics,
    checkDeviceWarnings,
    deleteAllWarningLogs
} from '../controllers/deviceWarningLogs/deviceWarningLogs.controller.js';
// Add this import at the top with the other imports

const router = express.Router();

// AUO Display routes
router.get('/auo-display', getAllAuoDisplay);
router.get('/auo-display/latest', getLatestAuoDisplay);
router.get('/auo-display/1hour', getAuoDisplay1Hour);
router.get('/auo-display/6hours', getAuoDisplay6Hours);
router.get('/auo-display/24hours', getAuoDisplay24Hours);
router.get('/auo-display/7days', getAuoDisplay7Days);
router.get('/auo-display/30days', getAuoDisplay30Days);
router.get('/auo-display/range', getAuoDisplayByDateRange);
router.post('/auo-display', addAuoDisplay);

// Camera Control Unit routes
router.get('/camera-control', getAllCameraControl);
router.get('/camera-control/latest', getLatestCameraControl);
router.get('/camera-control/1hour', getCameraControl1Hour);
router.get('/camera-control/6hours', getCameraControl6Hours);
router.get('/camera-control/24hours', getCameraControl24Hours);
router.get('/camera-control/7days', getCameraControl7Days);
router.get('/camera-control/30days', getCameraControl30Days);
router.get('/camera-control/range', getCameraControlByDateRange);
router.post('/camera-control', addCameraControl);

// Electronic Endoflator routes
router.get('/electronic', getAllElectronic);
router.get('/electronic/latest', getLatestElectronic);
router.get('/electronic/1hour', getElectronic1Hour);
router.get('/electronic/6hours', getElectronic6Hours);
router.get('/electronic/24hours', getElectronic24Hours);
router.get('/electronic/7days', getElectronic7Days);
router.get('/electronic/30days', getElectronic30Days);
router.get('/electronic/range', getElectronicByDateRange);
router.post('/electronic', addElectronic);

// LED Nova 100 routes
router.get('/led-nova', getAllLedNova);
router.get('/led-nova/latest', getLatestLedNova);
router.get('/led-nova/1hour', getLedNova1Hour);
router.get('/led-nova/6hours', getLedNova6Hours);
router.get('/led-nova/24hours', getLedNova24Hours);
router.get('/led-nova/7days', getLedNova7Days);
router.get('/led-nova/30days', getLedNova30Days);
router.get('/led-nova/range', getLedNovaByDateRange);
router.post('/led-nova', addLedNova);

// IoT Environment Status routes
router.get('/iot-env', getAllIotEnv);
router.get('/iot-env/latest', getLatestIotEnv);
router.get('/iot-env/1hour', getIotEnv1Hour);
router.get('/iot-env/6hours', getIotEnv6Hours);
router.get('/iot-env/24hours', getIotEnv24Hours);
router.get('/iot-env/7days', getIotEnv7Days);
router.get('/iot-env/30days', getIotEnv30Days);
router.get('/iot-env/range', getIotEnvByDateRange);
router.post('/iot-env', addIotEnv);

// Warning Logs routes
router.get('/warnings', getAllWarningLogs);
router.get('/warnings/latest', getLatestWarningLogs);
router.get('/warnings/active', getActiveWarnings);
router.get('/warnings/statistics', getWarningStatistics);
router.put('/warnings/:id/acknowledge', acknowledgeWarning);
router.put('/warnings/:id/resolve', resolveWarning);
router.post('/warnings/delete-all', deleteAllWarningLogs);
// Test endpoint to manually check warnings for current data
router.post('/warnings/test', async (req, res) => {
    try {
        const { device_type, data } = req.body;
        const warnings = await checkDeviceWarnings(device_type, data);
        res.json({
            success: true,
            warnings_created: warnings?.length || 0,
            warnings: warnings || []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;