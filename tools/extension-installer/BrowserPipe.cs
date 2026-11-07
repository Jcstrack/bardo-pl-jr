using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

namespace BardoInstaller;

internal static class BrowserPipe
{
    private const uint HandleFlagInherit = 1;
    private const uint CreateNoWindow = 0x08000000;

    public static string Load(string executable, string profilePath, string extensionPath,
        bool headless, bool keepOpen, Action<string>? onLoaded = null)
    {
        Directory.CreateDirectory(profilePath);
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), InheritHandle = true };
        if (!CreatePipe(out var childRead, out var parentWrite, ref attributes, 0) ||
            !CreatePipe(out var parentRead, out var childWrite, ref attributes, 0))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudieron crear las tuberías del navegador.");

        ProcessInformation process = default;
        try
        {
            if (!SetHandleInformation(parentWrite, HandleFlagInherit, 0) ||
                !SetHandleInformation(parentRead, HandleFlagInherit, 0))
                throw new Win32Exception(Marshal.GetLastWin32Error());

            var command = new StringBuilder(
                $"\"{executable}\" --user-data-dir=\"{profilePath}\" " +
                $"--remote-debugging-pipe --remote-debugging-io-pipes={childRead.ToInt64()},{childWrite.ToInt64()} " +
                "--enable-unsafe-extension-debugging --no-first-run --no-default-browser-check " +
                (headless ? "--headless=new " : "") + "about:blank");
            var startup = new StartupInfo { Length = Marshal.SizeOf<StartupInfo>() };
            if (!CreateProcess(null, command, IntPtr.Zero, IntPtr.Zero, true, CreateNoWindow,
                    IntPtr.Zero, null, ref startup, out process))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "No se pudo iniciar el navegador.");

            CloseHandle(childRead);
            CloseHandle(childWrite);
            childRead = childWrite = IntPtr.Zero;

            using var writerHandle = new SafeFileHandle(parentWrite, true);
            using var readerHandle = new SafeFileHandle(parentRead, true);
            parentWrite = parentRead = IntPtr.Zero;
            using var output = new FileStream(writerHandle, FileAccess.Write);
            using var input = new FileStream(readerHandle, FileAccess.Read);

            // The protocol uses NUL-delimited JSON on private process-owned pipes.
            Request(output, input, 1, "Browser.getVersion", null);
            var result = Request(output, input, 2, "Extensions.loadUnpacked", new { path = extensionPath });
            var id = result.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("El navegador no devolvió el ID de la extensión.");

            var extensions = Request(output, input, 3, "Extensions.getExtensions", null)
                .GetProperty("extensions").EnumerateArray().ToArray();
            if (!extensions.Any(extension =>
                    extension.GetProperty("id").GetString() == id &&
                    extension.GetProperty("enabled").GetBoolean()))
                throw new InvalidOperationException("La extensión no quedó habilitada en el perfil del navegador. Estado: " +
                    string.Join(", ", extensions.Select(extension => extension.GetRawText())));

            onLoaded?.Invoke(id);
            if (keepOpen)
                WaitForSingleObject(process.Process, uint.MaxValue);
            else
            {
                Send(output, 4, "Browser.close", null);
                if (WaitForSingleObject(process.Process, 10000) != 0)
                    throw new TimeoutException("El navegador no cerró su sesión de prueba.");
            }
            return id;
        }
        finally
        {
            if (childRead != IntPtr.Zero) CloseHandle(childRead);
            if (childWrite != IntPtr.Zero) CloseHandle(childWrite);
            if (parentWrite != IntPtr.Zero) CloseHandle(parentWrite);
            if (parentRead != IntPtr.Zero) CloseHandle(parentRead);
            if (process.Process != IntPtr.Zero)
            {
                if (WaitForSingleObject(process.Process, 0) != 0) TerminateProcess(process.Process, 1);
                CloseHandle(process.Process);
            }
            if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
        }
    }

    private static JsonElement Request(FileStream output, FileStream input, int id, string method, object? parameters)
    {
        Send(output, id, method, parameters);
        var task = Task.Run(() =>
        {
            while (true)
            {
                var bytes = new List<byte>();
                int next;
                while ((next = input.ReadByte()) != 0)
                {
                    if (next < 0) throw new EndOfStreamException("El navegador cerró la conexión de instalación.");
                    bytes.Add((byte)next);
                    if (bytes.Count > 8_000_000) throw new InvalidOperationException("Respuesta demasiado grande del navegador.");
                }
                using var message = JsonDocument.Parse(bytes.ToArray());
                if (!message.RootElement.TryGetProperty("id", out var responseId) || responseId.GetInt32() != id) continue;
                if (message.RootElement.TryGetProperty("error", out var error))
                    throw new InvalidOperationException("El navegador rechazó " + method + ": " + error);
                return message.RootElement.GetProperty("result").Clone();
            }
        });
        if (!task.Wait(TimeSpan.FromSeconds(25)))
            throw new TimeoutException("El navegador tardó demasiado en cargar la extensión. Cierra la ventana de Bardo e inténtalo de nuevo.");
        return task.GetAwaiter().GetResult();
    }

    private static void Send(FileStream output, int id, string method, object? parameters)
    {
        var message = parameters is null
            ? JsonSerializer.Serialize(new { id, method })
            : JsonSerializer.Serialize(new { id, method, @params = parameters });
        var bytes = Encoding.UTF8.GetBytes(message + "\0");
        output.Write(bytes);
        output.Flush();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes
    {
        public int Length;
        public IntPtr SecurityDescriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool InheritHandle;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int Length;
        public IntPtr Reserved;
        public IntPtr Desktop;
        public IntPtr Title;
        public int X;
        public int Y;
        public int XSize;
        public int YSize;
        public int XCountChars;
        public int YCountChars;
        public int FillAttribute;
        public int Flags;
        public short ShowWindow;
        public short Reserved2;
        public IntPtr ReservedPointer;
        public IntPtr StdInput;
        public IntPtr StdOutput;
        public IntPtr StdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr Process;
        public IntPtr Thread;
        public int ProcessId;
        public int ThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreatePipe(out IntPtr readPipe, out IntPtr writePipe, ref SecurityAttributes attributes, int size);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcess(string? applicationName, StringBuilder commandLine,
        IntPtr processAttributes, IntPtr threadAttributes, [MarshalAs(UnmanagedType.Bool)] bool inheritHandles,
        uint creationFlags, IntPtr environment, string? currentDirectory, ref StartupInfo startup,
        out ProcessInformation information);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);
}
