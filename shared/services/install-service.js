import { Service } from 'node-windows';

const svc = new Service({
  name: 'IOT-BE-DX',
  description: 'IOT Backend with MQTT Client',
  script: 'E:\\BE-IOT\\BE-DX\\index.js',
  nodeOptions: [],
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', function() {
  svc.start();
  console.log('Service installed successfully');
});

svc.install();
