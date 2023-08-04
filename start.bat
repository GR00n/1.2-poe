pushd %~dp0
call git pull --rebase --autostash

call npm install --no-audit
cls
call npm run start
pause
