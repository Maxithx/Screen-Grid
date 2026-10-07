using System.Security.Cryptography;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ScreenGrid.Client.App.Resources;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Left panel of the home screen ("Share Your Computer"): the local device ID,
/// the access password and the incoming-connection toggle.
/// <para>
/// Phase 1 only generates placeholder values locally; the real identity is
/// created and persisted together with the crypto layer in a later phase.
/// </para>
/// </summary>
public partial class ShareComputerViewModel : ObservableObject
{
    private const string PasswordAlphabet =
        "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private const int PasswordLength = 9;

    [ObservableProperty]
    private string _displayId = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private bool _isAcceptingConnections = true;

    [ObservableProperty]
    private bool _isPasswordVisible;

    public ShareComputerViewModel()
    {
        DisplayId = GenerateId();
        Password = GeneratePassword();
    }

    /// <summary>Human readable connection state shown next to the status dot.</summary>
    public string StatusText => IsAcceptingConnections
        ? Strings.ReadyForConnections
        : Strings.NotAcceptingConnections;

    /// <summary>Tooltip for the show/hide password button.</summary>
    public string TogglePasswordVisibilityTooltip => IsPasswordVisible
        ? Strings.HidePassword
        : Strings.ShowPassword;

    /// <summary>The password as shown in the UI: plain text or masked dots.</summary>
    public string DisplayPassword => IsPasswordVisible
        ? Password
        : new string('\u2022', Password.Length);

    [RelayCommand]
    private void CopyId() => TryCopyToClipboard(DisplayId);

    [RelayCommand]
    private void CopyPassword() => TryCopyToClipboard(Password);

    [RelayCommand]
    private void RegeneratePassword()
    {
        Password = GeneratePassword();
        IsPasswordVisible = false;
    }

    [RelayCommand]
    private void TogglePasswordVisibility() => IsPasswordVisible = !IsPasswordVisible;

    partial void OnIsAcceptingConnectionsChanged(bool value) => OnPropertyChanged(nameof(StatusText));

    partial void OnIsPasswordVisibleChanged(bool value)
    {
        OnPropertyChanged(nameof(TogglePasswordVisibilityTooltip));
        OnPropertyChanged(nameof(DisplayPassword));
    }

    partial void OnPasswordChanged(string value) => OnPropertyChanged(nameof(DisplayPassword));

    private static string GenerateId()
    {
        // Nine digits grouped like AnyDesk: "123 456 789".
        Span<char> digits = stackalloc char[9];
        for (int i = 0; i < digits.Length; i++)
        {
            digits[i] = (char)('0' + RandomNumberGenerator.GetInt32(10));
        }

        return $"{new string(digits[..3])} {new string(digits[3..6])} {new string(digits[6..])}";
    }

    private static string GeneratePassword()
    {
        Span<char> buffer = stackalloc char[PasswordLength];
        for (int i = 0; i < buffer.Length; i++)
        {
            buffer[i] = PasswordAlphabet[RandomNumberGenerator.GetInt32(PasswordAlphabet.Length)];
        }

        return new string(buffer);
    }

    private static void TryCopyToClipboard(string text)
    {
        try
        {
            Clipboard.SetText(text);
        }
        catch
        {
            // The clipboard can be briefly locked by another process; ignore for now.
        }
    }
}
