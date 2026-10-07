using System.Globalization;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ScreenGrid.Client.App.Resources;
using ScreenGrid.Client.App.Services;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Placeholder remote-session screen. In Phase 1 it only shows the target ID
/// and hosts the reusable <c>VideoSurface</c> control; the real capture /
/// transport pipeline is wired up in later phases.
/// </summary>
public partial class SessionViewModel : ObservableObject
{
    private readonly IAppNavigator _navigator;

    [ObservableProperty]
    private string _remoteId = string.Empty;

    [ObservableProperty]
    private string _statusText = Strings.SessionConnecting;

    public SessionViewModel(IAppNavigator navigator)
    {
        _navigator = navigator;
    }

    /// <summary>Window/heading title, e.g. "Session with 482 913 776".</summary>
    public string Title => string.Format(CultureInfo.CurrentCulture, Strings.SessionWith, RemoteId);

    /// <summary>Prepares the view model for a (future) session with the given device.</summary>
    public void Begin(string remoteId)
    {
        RemoteId = remoteId;
        StatusText = Strings.SessionConnecting;
    }

    [RelayCommand]
    private void Disconnect() => _navigator.NavigateToHome();

    partial void OnRemoteIdChanged(string value) => OnPropertyChanged(nameof(Title));
}
