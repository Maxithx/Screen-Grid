using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using ScreenGrid.Client.App.Models;
using ScreenGrid.Client.App.Services;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Right panel of the home screen ("Get Access to Computer"): remote ID,
/// password and the Connect action, plus a short recent-connections list.
/// </summary>
public partial class AccessComputerViewModel : ObservableObject
{
    private readonly IAppNavigator _navigator;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(ConnectCommand))]
    private string _remoteId = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    public AccessComputerViewModel(IAppNavigator navigator)
    {
        _navigator = navigator;

        // Phase 1: sample history so the layout is populated. Replaced by a real,
        // persisted history in a later phase.
        RecentConnections.Add(new RecentConnection("Office-PC", "482 913 776", "2 days ago"));
        RecentConnections.Add(new RecentConnection("Home-Desk", "128 664 021", "Last week"));
    }

    /// <summary>Recently used remote devices.</summary>
    public ObservableCollection<RecentConnection> RecentConnections { get; } = new();

    /// <summary>True when there is at least one recent connection to display.</summary>
    public bool HasRecentConnections => RecentConnections.Count > 0;

    private bool CanConnect() => !string.IsNullOrWhiteSpace(RemoteId);

    [RelayCommand(CanExecute = nameof(CanConnect))]
    private void Connect() => _navigator.StartSession(RemoteId.Trim());

    [RelayCommand]
    private void ConnectToRecent(RecentConnection? connection)
    {
        if (connection is null)
        {
            return;
        }

        RemoteId = connection.Id;
        Connect();
    }
}
