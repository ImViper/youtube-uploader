@echo off
echo Starting YouTube Upload Worker...
cd ..
npm run build
node dist/start-worker.js