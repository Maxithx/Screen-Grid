# Third-party notices

ScreenGrid itself is licensed under the **PolyForm Noncommercial License 1.0.0**
(see [`LICENSE`](LICENSE)). It depends on the third-party components below, which
are used under their own licenses. Those licenses are **not** affected by
ScreenGrid's license, and their notices must be preserved in any distribution.

Update this file whenever a dependency is added, removed or upgraded.

---

## CommunityToolkit.Mvvm 8.4.2

* Used by: `ScreenGrid.Client.App` (MVVM: `ObservableObject`, `[ObservableProperty]`, `[RelayCommand]`)
* Homepage: <https://github.com/CommunityToolkit/dotnet>
* License: **MIT**

```
MIT License

Copyright (c) .NET Foundation and Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## WPF-UI 4.3.0

* Used by: `ScreenGrid.Client.App` (Fluent theme, custom title bar, Mica window)
* Homepage: <https://github.com/lepoco/wpfui>
* License: **MIT**

```
MIT License

Copyright (c) 2021-2024 lepo.co

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> The copyright lines above are reproduced as declared by the upstream projects.
> The authoritative copy for each package ships inside its NuGet package
> (`LICENSE` / `LICENSE.md`); verify against those when cutting a release.

---

## Runtime & framework

The .NET runtime and the WPF framework are components of **.NET**, distributed
under the **MIT License** (with additional notices for some runtime
components). See <https://github.com/dotnet/runtime/blob/main/LICENSE.TXT>.

## Planned dependencies (not yet referenced)

These are named in the design documents but **not yet** part of the build. Add
their notices here as soon as they are referenced:

| Component | Purpose | License (expected) |
| --------- | ------- | ------------------ |
| `NSec.Cryptography` | Ed25519 device identity | MIT |
| `Microsoft.Data.Sqlite` | Auth.Server storage | MIT |
| `Otp.NET` | TOTP (optional) | MIT |
| `Konscious.Security.Cryptography.Argon2` | Argon2id hashing | MIT |
| `MaxMind.GeoIP2` + GeoLite2 data | GeoIP | Apache-2.0 / MaxMind EULA |
| `MailKit` | Email codes over SMTP | MIT |
