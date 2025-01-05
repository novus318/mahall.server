export default {
    apps: [
      {
        name: 'server',
        script: 'index.js',
        instances: 'max',
        exec_mode: 'cluster',
        watch: false,
        log_file: 'logs/combined.log',
        error_file: 'logs/error.log',
        out_file: 'logs/out.log',
        merge_logs: true,
        env: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  