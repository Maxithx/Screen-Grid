using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ScreenGrid.Client.App.Services;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Settings placeholder. The toggles below are presentational in Phase 1 and
/// will be persisted once the configuration/security services are added.
/// </summary>
public partial class SettingsViewModel : ObservableObject
{
    private readonly IAppNavigator _navigator;

    [ObservableProperty]
    private bool _startWithWindows;

    [ObservableProperty]
    private bool _requirePassword = true;

    [ObservableProperty]
    private bool _autoAcceptVerifiedDevices;

    public SettingsViewModel(IAppNavigator navigator)
    {
        _navigator = navigator;
    }

    [RelayCommand]
    private void Back() => _navigator.NavigateToHome();
}
