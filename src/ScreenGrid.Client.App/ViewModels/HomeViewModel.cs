using CommunityToolkit.Mvvm.ComponentModel;
using ScreenGrid.Client.App.Services;

namespace ScreenGrid.Client.App.ViewModels;

/// <summary>
/// Home screen: the classic AnyDesk/Supremo two-panel layout made up of the
/// "Share Your Computer" and "Get Access to Computer" panels.
/// </summary>
public partial class HomeViewModel : ObservableObject
{
    public HomeViewModel(IAppNavigator navigator)
    {
        Share = new ShareComputerViewModel();
        Access = new AccessComputerViewModel(navigator);
    }

    /// <summary>Left panel: this device's ID / password / incoming toggle.</summary>
    public ShareComputerViewModel Share { get; }

    /// <summary>Right panel: connect to a remote device.</summary>
    public AccessComputerViewModel Access { get; }
}
