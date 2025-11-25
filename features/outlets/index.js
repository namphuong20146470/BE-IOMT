// features/outlets/index.js
import outletRoutes from './outlet.routes.js';
import outletController from './outlet.controller.js';
import outletService from './outlet.service.js';
import outletRepository from './outlet.repository.js';
import outletModel from './outlet.model.js';

export {
    outletRoutes,
    outletController,
    outletService,
    outletRepository,
    outletModel
};

export default {
    routes: outletRoutes,
    controller: outletController,
    service: outletService,
    repository: outletRepository,
    model: outletModel
};