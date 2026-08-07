@echo off
REM ============================================================================
REM  Find NHS hospital maps.
REM
REM  Run this and nothing else:
REM
REM      nhs-discover
REM
REM  Optionally pass a number to check only that many trusts, e.g. a quick trial:
REM
REM      nhs-discover 20
REM
REM  It fetches the NHS trust register, crawls trust websites for published map
REM  PDFs, then commits and pushes the results so they can be worked through.
REM
REM  A full run covers ~215 trusts and takes a few hours, because it honours
REM  every site's robots.txt and crawl delay. It saves as it goes: if it stops
REM  for any reason, run it again and it continues from where it left off.
REM
REM  This is a single file on purpose. Pasting several commands into a terminal
REM  is where this kept going wrong.
REM ============================================================================

setlocal

REM Work from the repository, wherever this was launched from — including a
REM double-click in Explorer, where the working directory is not the repo.
cd /d "%~dp0"

echo.
echo === Wayfinder: NHS hospital map discovery ===
echo.

REM --- Preflight -------------------------------------------------------------
REM The doctor checks the toolchain, the checkout and whether this machine can
REM actually reach the NHS servers. Failing here is far kinder than failing
REM three stages and twenty minutes later.
call node scripts/nhs/doctor.mjs --strict
if errorlevel 1 goto :preflight_failed

echo.
echo === Fetching the NHS trust register ===
echo.
call node scripts/nhs/fetch-ods.mjs --only etr
if errorlevel 1 goto :fetch_failed

echo.
if "%~1"=="" (
  echo === Crawling all NHS trusts. This takes a few hours. ===
  echo === Safe to interrupt: run nhs-discover again to continue. ===
) else (
  echo === Crawling %~1 trusts ===
)
echo.

REM node directly, not via npm: passing flags through "npm run" needs a --
REM separator that is easy to get wrong, and getting it wrong silently does
REM the wrong thing.
if "%~1"=="" (
  node scripts/nhs/discover-plans.mjs
) else (
  node scripts/nhs/discover-plans.mjs --limit %~1
)
if errorlevel 1 goto :crawl_failed

echo.
echo === Saving results ===
echo.
git add data
git commit -m "Add NHS hospital map discovery results"
if errorlevel 1 echo    (nothing new to commit - the results were already saved)
git push
if errorlevel 1 goto :push_failed

echo.
echo === Done ===
echo.
echo Results are in data\plan-candidates.json and have been pushed.
goto :end

:preflight_failed
echo.
echo === Stopped: the preflight check failed ===
echo.
echo The report above says which check failed. The two usual causes:
echo.
echo   * This checkout does not have the pipeline on it yet. Fix with:  git pull
echo   * This machine cannot reach the NHS servers. Check the connection.
echo.
goto :end

:fetch_failed
echo.
echo === Stopped: could not get the NHS trust register ===
echo.
echo Every source was refused - the messages above name which and why. This is
echo not necessarily your internet connection; some networks block the download
echo host specifically.
echo.
echo Manual way round it: open this in a browser,
echo.
echo     https://files.digital.nhs.uk/assets/ods/current/etr.zip
echo.
echo save the file into  data\raw\ods\  and then run:
echo.
echo     node scripts/nhs/fetch-ods.mjs --use-local
echo.
goto :end

:crawl_failed
echo.
echo === The crawl stopped early ===
echo.
echo Progress was saved. Run nhs-discover again to continue from where it
echo stopped - nothing is lost and it will not start over.
goto :end

:push_failed
echo.
echo === The results were saved locally but could not be pushed ===
echo.
echo The crawl worked. Only the upload failed - check the internet connection
echo and run: git push
goto :end

:end
echo.
pause
endlocal
