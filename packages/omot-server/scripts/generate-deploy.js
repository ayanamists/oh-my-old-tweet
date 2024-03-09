import fs from 'fs';

// clean all files in the deploy folder
fs.mkdirSync('deploy');

fs.mkdirSync('deploy/db-init');
fs.copyFileSync('service/db-init/migration.sql', 'deploy/db-init/migration.sql');

fs.mkdirSync('deploy/meilisync');
fs.copyFileSync('service/meilisync/config.yml', 'deploy/meilisync/config.yml');

fs.mkdirSync('deploy/nginx');
fs.copyFileSync('service/nginx/nginx.prod.conf', 'deploy/nginx/nginx.conf');

fs.copyFileSync('.env.user', 'deploy/.env');
fs.copyFileSync('service/docker-compose.prod.yml', 'deploy/docker-compose.yml');
