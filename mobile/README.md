# GRUK Mobile

Contenedor nativo Capacitor para Android/iOS. No contiene secretos ni acceso a MongoDB. El origen remoto permitido es https://gruk-finanzas-personales.onrender.com.

## Generación local
1. npm ci
2. npx cap add android
3. npx cap add ios (requiere macOS/Xcode)
4. npm run native:sync

Los proyectos nativos generados se compilan y firman con Android Studio/Xcode. Nunca versionar keystores, certificados, provisioning profiles ni secretos.
