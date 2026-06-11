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
  ],
}
