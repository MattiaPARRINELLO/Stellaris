@echo off
REM Script de création automatique du fichier .env pour Stellaris
REM Ce script crée le fichier .env avec des valeurs par défaut

echo ============================================
echo  Configuration de Stellaris
echo ============================================
echo.

REM Vérifie si .env existe déjà
if exist .env (
    echo Un fichier .env existe deja.
    echo Voulez-vous le remplacer ? ^(Tapez OUI pour remplacer^)
    set /p "confirm=Votre choix : "
    if /i not "%confirm%"=="OUI" (
        echo Configuration annulee.
        pause
        exit /b 0
    )
)

REM Crée le fichier .env avec les valeurs par défaut
echo # Configuration Stellaris - Generee automatiquement > .env
echo # Vous pouvez modifier ces valeurs si necessaire >> .env
echo. >> .env
echo # Cle admin pour proteger l'interface /admin >> .env
echo ADMIN_API_KEY=stellaris2025 >> .env
echo. >> .env
echo # Port du serveur web ^(3000 par defaut^) >> .env
echo PORT=3000 >> .env
echo. >> .env
echo # Configuration email ^(facultatif - laissez tel quel pour tester^) >> .env
echo SMTP_HOST=smtp.example.com >> .env
echo SMTP_PORT=587 >> .env
echo SMTP_SECURE=false >> .env
echo SMTP_USER=votre-email@example.com >> .env
echo SMTP_PASS=votre-mot-de-passe >> .env
echo SMTP_FROM=Stellaris ^<no-reply@example.com^> >> .env
echo ADMIN_NOTIFY_EMAIL=admin@example.com >> .env

echo.
echo ============================================
echo  Configuration terminee !
echo ============================================
echo.
echo Le fichier .env a ete cree avec succes.
echo.
echo Informations importantes :
echo - Cle admin : stellaris2025
echo - Port : 3000
echo - Email : Non configure ^(facultatif^)
echo.
echo Vous pouvez maintenant lancer le site avec START.bat
echo.
pause
