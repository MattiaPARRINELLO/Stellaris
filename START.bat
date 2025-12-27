@echo off
REM Script de démarrage automatique de Stellaris
REM Double-cliquez sur ce fichier pour lancer le site

title Stellaris - Demarrage

echo ============================================
echo  STELLARIS - Lancement du site
echo ============================================
echo.

REM Vérifie si Node.js est installé
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERREUR : Node.js n'est pas installe !
    echo.
    echo Veuillez d'abord installer Node.js :
    echo 1. Ouvrez le fichier TUTORIEL.html
    echo 2. Suivez les instructions d'installation
    echo.
    pause
    exit /b 1
)

REM Affiche la version de Node.js
echo Verification de Node.js...
node --version
echo.

REM Vérifie si le fichier .env existe
if not exist .env (
    echo Le fichier .env n'existe pas encore.
    echo Lancement de la configuration automatique...
    echo.
    call setup-env.bat
    if %errorlevel% neq 0 (
        echo Configuration annulee.
        pause
        exit /b 1
    )
)

REM Vérifie si node_modules existe
if not exist node_modules (
    echo Premiere execution detectee.
    echo Installation des composants necessaires...
    echo ^(Cela peut prendre 1-2 minutes^)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo ERREUR lors de l'installation.
        echo Verifiez votre connexion internet.
        pause
        exit /b 1
    )
    echo.
    echo Installation terminee !
    echo.
)

REM Lance le serveur
echo ============================================
echo  Demarrage du site...
echo ============================================
echo.
echo Le site va s'ouvrir dans votre navigateur.
echo.
echo IMPORTANT : Gardez cette fenetre ouverte !
echo Pour arreter le site, fermez cette fenetre
echo ou appuyez sur Ctrl+C
echo.
echo ============================================

REM Attendre 2 secondes puis ouvrir le navigateur
timeout /t 2 /nobreak >nul
start http://localhost:3000

REM Lance le serveur Node.js
npm start

pause
