import fs from 'fs';
import { exec } from 'child_process';

if (fs.existsSync('deploy')) {
  fs.rmdirSync('deploy', { recursive: true });
}
fs.mkdirSync('deploy');

fs.mkdirSync('deploy/db-init');
fs.copyFileSync('service/db-init/migration.sql', 'deploy/db-init/migration.sql');

fs.mkdirSync('deploy/meilisync');
fs.copyFileSync('service/meilisync/config.yml', 'deploy/meilisync/config.yml');

fs.mkdirSync('deploy/nginx');
fs.copyFileSync('service/nginx/nginx.prod.conf', 'deploy/nginx/nginx.conf');

fs.copyFileSync('.env.user', 'deploy/.env');
fs.copyFileSync('service/docker-compose.prod.yml', 'deploy/docker-compose.yml');

// zip the deploy folder
exec('zip -r deploy.zip deploy', (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
  console.error(stderr);
});