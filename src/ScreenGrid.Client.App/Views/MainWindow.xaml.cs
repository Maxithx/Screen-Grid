using ScreenGrid.Client.App.ViewModels;
using Wpf.Ui.Controls;

namespace ScreenGrid.Client.App.Views;

/// <summary>
/// Application shell window. Uses the WPF-UI Fluent window chrome (custom
/// title bar, Mica backdrop) and hosts the currently selected view.
/// </summary>
public partial class MainWindow : FluentWindow
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainWindowViewModel();
    }
}
