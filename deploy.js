import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deploy() {
  try {
    console.log('🚀 Starting deployment process...');
    
    // Set NODE_ENV to production
    process.env.NODE_ENV = 'production';
    
    // Build the frontend
    console.log('📦 Building the frontend...');
    await execAsync('npm run build');
    console.log('✅ Frontend built successfully');
    
    // Start the server
    console.log('🖥️ Starting the server...');
    const serverProcess = exec('node server.js');
    
    serverProcess.stdout.on('data', (data) => {
      console.log(data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString().trim());
    });
    
    console.log('✨ Deployment complete! Server is running.');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploy(); 