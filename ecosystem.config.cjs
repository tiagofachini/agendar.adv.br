module.exports = {
  apps: [
    {
      name: 'agendaradvbr',
      script: './server/src/index.js',
      cwd: '/var/www/agendaradvbr',
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
}
