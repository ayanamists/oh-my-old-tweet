# find the latest sql file
latest_sql=./prisma/migrations/20240309072628_init/migration.sql
echo "Copying $latest_sql to service/migration.sql"
cp $latest_sql ./service/db-init/migration.sql