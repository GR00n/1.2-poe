pushd %~dp0
call git pull --strategy-option=theirs

call npm install --no-audit
cls
call npm run start
pause
