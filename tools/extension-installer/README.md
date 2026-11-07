# Instalador de la extensión

`build.ps1` empaqueta `frontend/extension` dentro de un ejecutable Windows de un solo archivo con .NET 9, y lo deja en `../Bardo-Extension-Instalador/Instalar-Bardo-Extension.exe`.

```powershell
.\tools\extension-installer\build.ps1
```

Prueba no interactiva en un perfil temporal:

```powershell
& '..\Bardo-Extension-Instalador\Instalar-Bardo-Extension.exe' --smoke-test "$env:TEMP\bardo-installer-smoke.json"
Get-Content "$env:TEMP\bardo-installer-smoke.json"
```

El ejecutable copia su propio lanzador y la extensión a `%LOCALAPPDATA%\BardoPolitanenseExtension`, crea un acceso directo y abre un perfil separado. El lanzador usa `Extensions.loadUnpacked` por una tubería privada en cada inicio del perfil. Esta recarga es necesaria: Brave no conserva una extensión local cargada así al cerrar el navegador. El instalador nunca edita directamente los archivos `Preferences` del perfil del usuario.

El instalador muestra siempre **Brave, Opera GX y Opera**, en ese orden. Si falta un navegador, la opción indica que no se detectó y no permite instalarlo. Opera normal se probó con el perfil temporal del instalador: confirmó la extensión habilitada. El método no modifica el perfil habitual del navegador.
