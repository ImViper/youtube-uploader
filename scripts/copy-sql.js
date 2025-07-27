const fs = require('fs-extra');
const path = require('path');

async function copySqlFiles() {
    try {
        // Create directories
        const migrationsDir = path.join(__dirname, '..', 'dist', 'database', 'migrations');
        await fs.ensureDir(migrationsDir);
        
        // Copy migration files
        const srcMigrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
        const migrationFiles = await fs.readdir(srcMigrationsDir);
        
        for (const file of migrationFiles) {
            if (file.endsWith('.sql')) {
                await fs.copy(
                    path.join(srcMigrationsDir, file),
                    path.join(migrationsDir, file)
                );
                console.log(`Copied ${file}`);
            }
        }
        
        // Copy schema.sql
        const schemaSource = path.join(__dirname, '..', 'src', 'database', 'schema.sql');
        const schemaDest = path.join(__dirname, '..', 'dist', 'database', 'schema.sql');
        await fs.copy(schemaSource, schemaDest);
        console.log('Copied schema.sql');
        
        console.log('SQL files copied successfully');
    } catch (error) {
        console.error('Error copying SQL files:', error);
        process.exit(1);
    }
}

copySqlFiles();