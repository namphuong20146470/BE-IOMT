// features/sockets/index.js
import socketRoutes from './socket.routes.js';
import socketDataRoutes from './socket-data.routes.js';
import socketController from './socket.controller.js';
import socketDataController from './socket-data.controller.js';
import socketService from './socket.service.js';
import socketDataService from './socket-data.service.js';
import socketRepository from './socket.repository.js';
import socketModel from './socket.model.js';

export {
    socketRoutes,
    socketDataRoutes,
    socketController,
    socketDataController,
    socketService,
    socketDataService,
    socketRepository,
    socketModel
};

export default {
    routes: socketRoutes,
    dataRoutes: socketDataRoutes,
    controller: socketController,
    dataController: socketDataController,
    service: socketService,
    dataService: socketDataService,
    repository: socketRepository,
    model: socketModel
};