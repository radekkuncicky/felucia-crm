module.exports = {
  apps: [
    {
      name: 'nanto-crm',
      script: 'npm',
      args: 'start -- -p 3000',
      cwd: '/var/www/nanto-crm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/nanto-crm-error.log',
      out_file: '/var/log/pm2/nanto-crm-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'nanto-crm-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts',
      cwd: '/var/www/nanto-crm',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/nanto-crm-worker-error.log',
      out_file: '/var/log/pm2/nanto-crm-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
