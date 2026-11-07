using System.IO.Compression;
using System.Reflection;
using System.Text.Json;
using System.Diagnostics;

namespace BardoInstaller;

internal static class Program
{
    private const string ProductName = "Bardo Politanense JR";
    internal static readonly string[] BrowserOrder = ["Brave", "Opera GX", "Opera"];

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--smoke-test")
            return RunSmokeTest(args[1], "Brave");
        if (args.Length == 3 && args[0] == "--smoke-test")
            return RunSmokeTest(args[1], args[2]);
        if (args.Length == 2 && args[0] == "--launch")
            return RunLauncher(InstallRoot, args[1], null, false);
        if (args.Length == 3 && args[0] == "--launch-ready")
            return RunLauncher(InstallRoot, args[1], args[2], false);
        if (args.Length == 4 && args[0] == "--launch-test")
            return RunLauncher(args[1], args[2], args[3], true);
        if (args.Length == 2 && args[0] == "--install-report")
            return RunInstallReport(args[1], "Brave");
        if (args.Length == 3 && args[0] == "--install-report")
            return RunInstallReport(args[1], args[2]);

        ApplicationConfiguration.Initialize();
        Application.Run(new InstallerForm());
        return 0;
    }

    private static int RunInstallReport(string reportPath, string browserName)
    {
        try
        {
            var result = Install(InstallRoot, true, false, browserName);
            File.WriteAllText(reportPath, JsonSerializer.Serialize(new { success = true, result.BrowserName, result.ExtensionId, result.ProfilePath }));
            return 0;
        }
        catch (Exception error)
        {
            File.WriteAllText(reportPath, JsonSerializer.Serialize(new { success = false, error = error.ToString() }));
            return 1;
        }
    }

    private static int RunSmokeTest(string reportPath, string browserName)
    {
        var testRoot = Path.Combine(Path.GetTempPath(), "BardoInstallerTest-" + Guid.NewGuid().ToString("N"));
        try
        {
            var result = Install(testRoot, false, true, browserName);
            var report = new
            {
                success = true,
                result.BrowserName,
                result.ExtensionId,
                result.ExtensionPath,
                result.ProfilePath,
                launcher = File.Exists(GetLauncherPath(testRoot, browserName)),
            };
            File.WriteAllText(reportPath, JsonSerializer.Serialize(report));
            return 0;
        }
        catch (Exception error)
        {
            File.WriteAllText(reportPath, JsonSerializer.Serialize(new { success = false, testRoot, error = error.ToString() }));
            return 1;
        }
        finally
        {
            // The test root is created by this invocation under the OS temp directory.
            if (Directory.Exists(testRoot))
            {
                try { Directory.Delete(testRoot, true); }
                catch { /* A browser child can briefly retain a handle after Browser.close. */ }
            }
        }
    }

    internal static string InstallRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BardoPolitanenseExtension");

    private static string GetExtensionPath(string root, string browserName) =>
        Path.Combine(root, browserName == "Brave" ? "Extension" : "Extension-" + browserName.Replace(" ", ""));

    private static string GetLauncherPath(string root, string browserName) =>
        Path.Combine(root, browserName == "Brave" ? "BardoLauncher.exe" : "BardoLauncher-" + browserName.Replace(" ", "") + ".exe");

    private static int RunLauncher(string root, string browserName, string? readyFile, bool headless)
    {
        try
        {
            var browser = AvailableBrowsers().FirstOrDefault(item => item.Name == browserName)
                ?? throw new InvalidOperationException($"No se encontró {browserName}.");
            var extensionPath = GetExtensionPath(root, browserName);
            var profilePath = Path.Combine(root, browserName.Replace(" ", "") + "Profile");
            BrowserPipe.Load(browser.Executable, profilePath, extensionPath, headless, true, id =>
            {
                if (readyFile is not null)
                    WriteReadyFile(readyFile, new { extensionId = id });
            });
            return 0;
        }
        catch (Exception error)
        {
            if (readyFile is not null)
                WriteReadyFile(readyFile, new { error = error.Message });
            else
                MessageBox.Show(error.Message, "Bardo no pudo abrir el navegador", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void WriteReadyFile(string path, object value)
    {
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(value));
        File.Move(temporary, path, true);
    }

    internal static IReadOnlyList<BrowserChoice> AvailableBrowsers()
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var candidates = new List<BrowserChoice>
        {
            new("Brave", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "BraveSoftware", "Brave-Browser", "Application", "brave.exe")),
            new("Brave", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "BraveSoftware", "Brave-Browser", "Application", "brave.exe")),
            new("Brave", Path.Combine(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")),
        };
        foreach (var (name, folder) in new[]
        {
            ("Opera GX", Path.Combine(local, "Programs", "Opera GX")),
            ("Opera", Path.Combine(local, "Programs", "Opera")),
            ("Opera GX", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera GX")),
            ("Opera", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Opera")),
        })
        {
            if (!Directory.Exists(folder)) continue;
            candidates.Add(new BrowserChoice(name, Path.Combine(folder, "opera.exe")));
            foreach (var versionFolder in Directory.GetDirectories(folder).OrderDescending())
                candidates.Add(new BrowserChoice(name, Path.Combine(versionFolder, "opera.exe")));
        }
        var detected = candidates.Where(candidate => File.Exists(candidate.Executable))
            .GroupBy(candidate => candidate.Name)
            .ToDictionary(group => group.Key, group => group.First());
        return BrowserOrder.Where(detected.ContainsKey)
            .Select(name => detected[name])
            .ToArray();
    }

    internal static InstallResult Install(string root, bool makeShortcut, bool smokeTest, string? preferredBrowser = null)
    {
        var browsers = AvailableBrowsers();
        var browser = preferredBrowser is null
            ? browsers.FirstOrDefault()
            : browsers.FirstOrDefault(candidate => candidate.Name == preferredBrowser);
        if (browser is null)
            throw new InvalidOperationException(preferredBrowser is null
                ? "Instala Brave, Opera GX u Opera antes de ejecutar Bardo."
                : $"No se encontró {preferredBrowser} en este equipo.");

        var browserFolder = browser.Name.Replace(" ", "");
        var extensionPath = Path.GetFullPath(GetExtensionPath(root, browser.Name));
        var profilePath = Path.GetFullPath(Path.Combine(root, browserFolder + "Profile"));
        var launcherPath = GetLauncherPath(root, browser.Name);
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(extensionPath);

        using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(
            Assembly.GetExecutingAssembly().GetManifestResourceNames().Single(name => name.EndsWith("extension.zip"))))
        {
            if (resource is null) throw new InvalidOperationException("El instalador no contiene la extensión.");
            ZipFile.ExtractToDirectory(resource, extensionPath, true);
        }
        if (!File.Exists(Path.Combine(extensionPath, "manifest.json")))
            throw new InvalidOperationException("La extensión empaquetada no tiene manifest.json.");

        var currentExe = Environment.ProcessPath ?? throw new InvalidOperationException("No se encontró el ejecutable del instalador.");
        if (!Path.GetFullPath(currentExe).Equals(Path.GetFullPath(launcherPath), StringComparison.OrdinalIgnoreCase))
            File.Copy(currentExe, launcherPath, true);

        var readyFile = Path.Combine(root, "ready-" + Guid.NewGuid().ToString("N") + ".json");
        using var launcher = new Process
        {
            StartInfo = new ProcessStartInfo(launcherPath) { UseShellExecute = false, CreateNoWindow = true },
        };
        launcher.StartInfo.ArgumentList.Add(smokeTest ? "--launch-test" : "--launch-ready");
        if (smokeTest) launcher.StartInfo.ArgumentList.Add(root);
        launcher.StartInfo.ArgumentList.Add(browser.Name);
        launcher.StartInfo.ArgumentList.Add(readyFile);
        launcher.Start();
        var installed = false;
        try
        {
            var deadline = DateTime.UtcNow.AddSeconds(30);
            while (!File.Exists(readyFile) && !launcher.HasExited && DateTime.UtcNow < deadline)
                Thread.Sleep(100);
            if (!File.Exists(readyFile))
                throw new TimeoutException("El navegador no confirmó la instalación. Cierra Bardo y vuelve a intentarlo.");
            using var status = JsonDocument.Parse(File.ReadAllText(readyFile));
            if (status.RootElement.TryGetProperty("error", out var error))
                throw new InvalidOperationException(error.GetString());
            var extensionId = status.RootElement.GetProperty("extensionId").GetString()
                ?? throw new InvalidOperationException("Falta el ID de la extensión.");
            Thread.Sleep(400);
            if (launcher.HasExited)
                throw new InvalidOperationException("El navegador cerró antes de completar la instalación.");
            File.WriteAllText(Path.Combine(root, browserFolder + "Install.json"),
                JsonSerializer.Serialize(new { browser = browser.Name, extensionId, installedAt = DateTimeOffset.UtcNow }));
            if (makeShortcut) CreateShortcut(browser, launcherPath);
            installed = true;
            return new InstallResult(browser.Name, extensionId, extensionPath, profilePath);
        }
        finally
        {
            if ((smokeTest || !installed) && !launcher.HasExited) launcher.Kill(true);
            if (File.Exists(readyFile)) File.Delete(readyFile);
        }
    }

    private static void CreateShortcut(BrowserChoice browser, string launcherPath)
    {
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var linkPath = Path.Combine(desktop, ProductName + " (" + browser.Name + ").lnk");
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("Windows Script Host no está disponible para crear el acceso directo.");
        dynamic shell = Activator.CreateInstance(shellType)!;
        dynamic shortcut = shell.CreateShortcut(linkPath);
        shortcut.TargetPath = launcherPath;
        shortcut.Arguments = "--launch \"" + browser.Name + "\"";
        shortcut.WorkingDirectory = Path.GetDirectoryName(launcherPath)!;
        shortcut.Description = "Abre " + ProductName + " con la extensión activa";
        shortcut.IconLocation = browser.Executable + ",0";
        shortcut.Save();
    }
}

internal sealed record BrowserChoice(string Name, string Executable);
internal sealed record InstallResult(string BrowserName, string ExtensionId, string ExtensionPath, string ProfilePath);

internal sealed class InstallerForm : Form
{
    private readonly Button installButton = new() { Text = "Instalar", Width = 130, Height = 38 };
    private readonly Label status = new() { AutoSize = false, Width = 420, Height = 58 };
    private readonly ComboBox browserPicker = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 230 };

    public InstallerForm()
    {
        Text = "Instalar Bardo Politanense JR";
        ClientSize = new Size(470, 245);
        MinimumSize = MaximumSize = Size;
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(29, 28, 37);
        ForeColor = Color.White;

        var title = new Label { Text = "Bardo Politanense JR", Font = new Font("Segoe UI", 16, FontStyle.Bold), AutoSize = true, Location = new Point(24, 20) };
        var description = new Label
        {
            Text = "Instala la extensión en un perfil propio del navegador.\nNo necesita Modo desarrollador ni pasos adicionales.",
            AutoSize = false, Size = new Size(420, 46), Location = new Point(24, 59),
        };
        browserPicker.Location = new Point(24, 118);
        foreach (var name in Program.BrowserOrder) browserPicker.Items.Add(name);
        browserPicker.SelectedIndexChanged += (_, _) => RefreshBrowserAvailability();
        var firstAvailable = Program.AvailableBrowsers().FirstOrDefault()?.Name;
        browserPicker.SelectedIndex = firstAvailable is null
            ? 0
            : Array.IndexOf(Program.BrowserOrder, firstAvailable);
        status.Location = new Point(24, 161);
        installButton.Location = new Point(316, 113);
        installButton.BackColor = Color.FromArgb(181, 150, 228);
        installButton.ForeColor = Color.FromArgb(24, 22, 31);
        installButton.FlatStyle = FlatStyle.Flat;
        installButton.Click += InstallClicked;
        Controls.AddRange([title, description, browserPicker, status, installButton]);
        RefreshBrowserAvailability();
    }

    private void RefreshBrowserAvailability()
    {
        var name = browserPicker.SelectedItem?.ToString();
        var available = Program.AvailableBrowsers().Any(browser => browser.Name == name);
        installButton.Enabled = available;
        status.Text = available
            ? $"Listo para instalar en {name}."
            : $"{name} no se encontró en este equipo. Elige otro navegador o instálalo.";
    }

    private async void InstallClicked(object? sender, EventArgs args)
    {
        installButton.Enabled = false;
        browserPicker.Enabled = false;
        status.Text = "Instalando la extensión. Espera unos segundos…";
        try
        {
            var browserName = browserPicker.SelectedItem?.ToString();
            var result = await Task.Run(() => Program.Install(Program.InstallRoot, true, false, browserName));
            status.Text = $"Instalado en {result.BrowserName}. Usa el acceso directo del escritorio para abrir Bardo.";
            installButton.Text = "Instalado";
        }
        catch (Exception error)
        {
            status.Text = "No se pudo instalar: " + error.Message;
            installButton.Enabled = Program.AvailableBrowsers().Any(browser => browser.Name == browserPicker.SelectedItem?.ToString());
            browserPicker.Enabled = true;
        }
    }
}
