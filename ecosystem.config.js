module.exports = {
  apps: [{
    name: "iomt",
    script: "./index.js",
    instances: "max",
    exec_mode: "cluster",
    watch: true,
    ignore_watch: ["node_modules", "logs", "uploads"],
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}