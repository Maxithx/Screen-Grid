using System.Globalization;
using System.Reflection;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ScreenGrid.Client.App.Resources;
using ScreenGrid.Client.App.Services;
using Wpf.Ui.Appearance;
using Wpf.Ui.Controls;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Shell view model. Owns the top-level view models, drives navigation between
/// them and implements <see cref="IAppNavigator"/> so child view models can
/// request screen changes without knowing about the window.
/// </summary>
public partial class MainWindowViewModel : ObservableObject, IAppNavigator
{
    private readonly HomeViewModel _home;
    private readonly SessionViewModel _session;
    private readonly SettingsViewModel _settings;

    [ObservableProperty]
    private object? _currentView;

    [ObservableProperty]
    private string _statusText = Strings.StatusReady;

    [ObservableProperty]
    private bool _isDarkTheme = true;

    public MainWindowViewModel()
    {
        _home = new HomeViewModel(this);
        _session = new SessionViewModel(this);
        _settings = new SettingsViewModel(this);

        CurrentView = _home;
    }

    /// <summary>Localized application name, shown in the title bar.</summary>
    public string AppName => Strings.AppName;

    /// <summary>Icon for the theme toggle: a moon in dark mode, a sun in light mode.</summary>
    public SymbolRegular ThemeIcon => IsDarkTheme
        ? SymbolRegular.WeatherMoon24
        : SymbolRegular.WeatherSunny24;

    /// <summary>Localized, human readable version string for the status bar.</summary>
    public string VersionText
    {
        get
        {
            Version? version = typeof(MainWindowViewModel).Assembly.GetName().Version;
            string display = version is null ? "0.1.0" : version.ToString(3);
            return string.Format(CultureInfo.CurrentCulture, Strings.VersionFormat, display);
        }
    }

    // ---- Navigation (IAppNavigator) -------------------------------------

    public void NavigateToHome()
    {
        CurrentView = _home;
        StatusText = Strings.StatusReady;
    }

    public void NavigateToSettings() => CurrentView = _settings;

    public void StartSession(string remoteId)
    {
        _session.Begin(remoteId);
        StatusText = _session.Title;
        CurrentView = _session;
    }

    // ---- Commands --------------------------------------------------------

    [RelayCommand]
    private void NavigateHome() => NavigateToHome();

    [RelayCommand]
    private void NavigateSettings() => NavigateToSettings();

    /// <summary>Toggles between the dark and light theme.</summary>
    [RelayCommand]
    private void ToggleTheme()
    {
        IsDarkTheme = !IsDarkTheme;

        ApplicationThemeManager.Apply(
            IsDarkTheme ? ApplicationTheme.Dark : ApplicationTheme.Light,
            WindowBackdropType.Mica,
            updateAccent: true);
    }

    partial void OnIsDarkThemeChanged(bool value) => OnPropertyChanged(nameof(ThemeIcon));
}
